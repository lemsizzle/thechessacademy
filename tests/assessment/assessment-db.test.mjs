import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '../../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js';

test('assessments preserve answers, enforce deadlines and ownership, grade once, and restrict browser roles', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create table students(id uuid primary key,is_active boolean default true); grant select on students to service_role;');
    await db.exec(readFileSync('supabase/migrations/20261121081736_chess_knowledge_assessment.sql','utf8'));
    const a=randomUUID(),b=randomUUID(),inactive=randomUUID();
    await db.query('insert into students values($1,true),($2,true),($3,false)',[a,b,inactive]);
    const key=Object.fromEntries(Array.from({length:30},(_,i)=>['q'+i,'a']));
    const start=async(who=a)=>(await db.query('select to_jsonb(start_chess_assessment($1,$2)) value',[who,'knowledge-a-v1'])).rows[0].value;
    const save=async(id,answers={},submit=false,who=a)=>(await db.query('select to_jsonb(save_chess_assessment($1,$2,$3,$4,$5)) value',[who,id,JSON.stringify(answers),submit,JSON.stringify(key)])).rows[0].value;
    await db.exec('set role service_role');
    const [first,second]=await Promise.all([start(),start()]); assert.equal(first.id,second.id);
    assert.equal(Math.round((Date.parse(first.deadline_at)-Date.parse(first.started_at))/1000),1800);
    await assert.rejects(()=>start(inactive),/Student unavailable/);
    await save(first.id,{q0:'a',q1:'b'}); const saved=await save(first.id,{q2:'a'}); assert.deepEqual(saved.answers,{q0:'a',q1:'b',q2:'a'});
    await assert.rejects(()=>save(first.id,{q0:'a'},true,b),/Assessment unavailable/);
    await assert.rejects(()=>save(first.id,{unknown:'a'}),/Invalid answers/);
    const result=await save(first.id,{q3:'a'},true); assert.equal(result.correct_count,3);
    const duplicate=await save(first.id,key,true); assert.equal(duplicate.correct_count,3); assert.deepEqual(duplicate.answers,result.answers);
    const next=await start(); assert.notEqual(next.id,first.id); await save(next.id,{q0:'a'});
    await db.query("update student_chess_assessments set deadline_at=clock_timestamp()-interval '1 second' where id=$1",[next.id]);
    const expired=await save(next.id,key,true); assert.equal(expired.correct_count,1); assert.deepEqual(expired.answers,{q0:'a'});
    const abandoned=await start(b); await save(abandoned.id,{q0:'a',q1:'a'},false,b);
    await db.query("update student_chess_assessments set deadline_at=clock_timestamp()-interval '1 second' where id=$1",[abandoned.id]);
    assert.equal((await db.query('select finish_expired_chess_assessments($1) n',[JSON.stringify(key)])).rows[0].n,1);
    assert.equal((await save(abandoned.id,key,true,b)).correct_count,2);
    for(const role of ['anon','authenticated']) { await db.exec(`reset role;set role ${role}`); await assert.rejects(()=>start(),/permission denied/); await assert.rejects(()=>save(first.id,key,true),/permission denied/); await assert.rejects(()=>db.query('select * from student_chess_assessments'),/permission denied/); }
    await db.exec('reset role'); assert.equal((await db.query("select relrowsecurity from pg_class where relname='student_chess_assessments'")).rows[0].relrowsecurity,true);
  } finally { await db.close(); }
});
