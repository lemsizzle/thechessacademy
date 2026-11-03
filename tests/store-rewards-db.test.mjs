import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createStoreTestDatabase,
  addStudent,
  buy,
  resolveCoupon,
} from "./fixtures/store-rewards-db.mjs";

test("store purchases, retries, duplicate exclusions, coupon stacking and refunds are transactional", async () => {
  const db = await createStoreTestDatabase();
  try {
    const student = await addStudent(db),
      other = await addStudent(db, 499);
    const balance = async (id) =>
      (
        await db.query(
          "select academy_coins from student_wallets where student_id=$1",
          [id],
        )
      ).rows[0].academy_coins;
    const first = await buy(db, student, "free_class"),
      second = await buy(db, student, "free_class");
    assert.equal(first.status, "pending");
    assert.equal(first.item_id, null);
    assert.equal(await balance(student), 2000);
    assert.deepEqual(await buy(db, student, "free_class", first.id), first);
    assert.equal(await balance(student), 2000);
    await assert.rejects(
      buy(db, other, "free_class", first.id),
      /reference is already in use/,
    );
    await assert.rejects(
      buy(db, student, "mystery_box", first.id),
      /reference is already in use/,
    );
    await assert.rejects(buy(db, other, "mystery_box"), /Not enough/);
    await assert.rejects(buy(db, student, "mystery_box"), /every available/);
    assert.equal(await balance(student), 2000);

    const cheap = randomUUID(),
      expensive = randomUUID();
    await db.query(
      `insert into avatar_items(id,name,price,category,unlock_type) values
      ($1,'Cap',50,'headwear','purchase'),($2,'Crown',500,'headwear','purchase'),
      (gen_random_uuid(),'Achievement',200,'headwear','achievement'),(gen_random_uuid(),'Board',200,'board_theme','purchase'),
      (gen_random_uuid(),'Default',0,'eyes','default')`,
      [cheap, expensive],
    );
    await db.exec(
      "insert into avatar_items(name,price,category,unlock_type,is_active) values('Retired',10,'hair','purchase',false)",
    );
    const boxes = await Promise.all([
      buy(db, student, "mystery_box"),
      buy(db, student, "mystery_box"),
    ]);
    assert.deepEqual(
      new Set(boxes.map((r) => r.item_id)),
      new Set([cheap, expensive]),
    );
    assert.equal(await balance(student), 1000);
    assert.deepEqual(
      await buy(db, student, "mystery_box", boxes[0].id),
      boxes[0],
    );
    await assert.rejects(buy(db, student, "mystery_box"), /every available/);
    assert.equal(await balance(student), 1000);
    assert.equal(
      (await db.query("select count(*)::int n from coin_transactions")).rows[0]
        .n,
      4,
    );
    assert.equal(
      (await db.query("select count(*)::int n from student_inventory")).rows[0]
        .n,
      2,
    );

    await resolveCoupon(db, first.id, "fulfilled");
    await resolveCoupon(db, first.id, "fulfilled");
    await assert.rejects(
      resolveCoupon(db, first.id, "refunded"),
      /already been resolved/,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from store_reward_receipts where status='pending'",
        )
      ).rows[0].n,
      1,
    );
    await resolveCoupon(db, second.id, "refunded");
    await resolveCoupon(db, second.id, "refunded");
    assert.equal(await balance(student), 6000);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from coin_transactions where transaction_type='refund'",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      resolveCoupon(db, boxes[0].id, "refunded"),
      /not found/,
    );
    const poor = await addStudent(db, 5000);
    const attempts = await Promise.allSettled([
      buy(db, poor, "free_class"),
      buy(db, poor, "free_class"),
    ]);
    assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
    assert.equal(await balance(poor), 0);
    await db.query("update students set is_active=false where id=$1", [other]);
    await assert.rejects(buy(db, other, "free_class"), /no longer active/);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(buy(db, student, "free_class"), /permission denied/);
      await assert.rejects(
        db.query("select * from store_reward_receipts"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.deepEqual(
      await buy(db, student, "mystery_box", boxes[0].id),
      boxes[0],
    );
  } finally {
    await db.close();
  }
});

test("cost-weighted mystery rolls favor cheap items without excluding expensive ones", async () => {
  const db = await createStoreTestDatabase();
  try {
    const student = await addStudent(db, 200000),
      cheap = randomUUID(),
      expensive = randomUUID();
    await db.query(
      "insert into avatar_items(id,name,price,category,unlock_type) values($1,'Cap',50,'headwear','purchase'),($2,'Crown',500,'headwear','purchase')",
      [cheap, expensive],
    );
    await db.query("select setseed(0.42)");
    let cheapCount = 0;
    for (let i = 0; i < 200; i++) {
      const receipt = await buy(db, student, "mystery_box");
      if (receipt.item_id === cheap) cheapCount++;
      await db.query("delete from student_inventory where student_id=$1", [
        student,
      ]);
    }
    assert.ok(
      cheapCount > 160 && cheapCount < 199,
      `cheap drops ${cheapCount}/200`,
    );
  } finally {
    await db.close();
  }
});
