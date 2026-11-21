import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
import {PGlite} from '../../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js';
test('skills and original assessments retain separate grading, deadlines, alternatives, and ownership',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table students(id uuid primary key,is_active boolean default true);grant select on students to service_role;');
 for(const file of ['20261121081736_chess_knowledge_assessment.sql','20261121083317_chess_skills_assessment.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 const student=randomUUID(),other=randomUUID();await db.query('insert into students(id) values($1),($2)',[student,other]);
 const positions=JSON.parse(readFileSync('lib/assessment/skillsPositions.json','utf8')),key=Object.fromEntries(positions.map(q=>[q.id,q.acceptedMoves]));
 const legacy=Object.fromEntries(Array.from({length:30},(_,i)=>['q'+i,'a']));
 const start=async(version)=>(await db.query('select to_jsonb(start_chess_assessment($1,$2)) value',[student,version])).rows[0].value;
 const save=async(id,answers,submit=true,version='skills-b-v1',grading=key,who=student)=>(await db.query('select to_jsonb(save_chess_assessment_v2($1,$2,$3,$4,$5,$6)) value',[who,id,JSON.stringify(answers),submit,JSON.stringify(grading),version])).rows[0].value;
 await db.exec('set role service_role');
 const old=await start('knowledge-a-v1');assert.equal((await start('skills-b-v1')).id,old.id);
 assert.equal((await save(old.id,{q0:'a'},true,'knowledge-a-v1',legacy)).correct_count,1);
 const active=await start('skills-b-v1');const correct=Object.fromEntries(positions.map(q=>[q.id,q.acceptedMoves[0]]));correct.b29='h2h1r';
 await assert.rejects(()=>save(active.id,correct,true,'knowledge-a-v1',legacy),/version/);
 await assert.rejects(()=>save(active.id,correct,true,'skills-b-v1',key,other),/unavailable/);
 const result=await save(active.id,correct);assert.equal(result.correct_count,30);assert.equal((await save(active.id,{})).correct_count,30);
 assert.equal((await save(old.id,{},true,'knowledge-a-v1',legacy)).correct_count,1);
 const expired=await start('skills-b-v1');await save(expired.id,{b30:'c7c8q'},false);await db.query("update student_chess_assessments set deadline_at=clock_timestamp()-interval '1 second' where id=$1",[expired.id]);
 assert.equal((await save(expired.id,correct)).correct_count,0);
 const abandoned=await start('skills-b-v1');await save(abandoned.id,{b29:'h2h1r'},false);await db.query("update student_chess_assessments set deadline_at=clock_timestamp()-interval '1 second' where id=$1",[abandoned.id]);
 assert.equal((await db.query('select finish_expired_chess_assessments_v2($1,$2) n',[JSON.stringify(legacy),'knowledge-a-v1'])).rows[0].n,0);
 assert.equal((await db.query('select finish_expired_chess_assessments_v2($1,$2) n',[JSON.stringify(key),'skills-b-v1'])).rows[0].n,1);
 assert.equal((await save(abandoned.id,{})).correct_count,1);
 await db.exec('reset role;set role anon');await assert.rejects(()=>save(active.id,correct),/permission denied/);
 }finally{await db.close();}
});
