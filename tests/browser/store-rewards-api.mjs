// Fixture HTTP adapter uses the actual migration/RPCs in isolated PostgreSQL.
// Authentication is intentionally stubbed here; real route guards have unit tests.
import {
  createStoreTestDatabase,
  addStudent,
  buy,
  resolveCoupon,
} from "../fixtures/store-rewards-db.mjs";
const db = await createStoreTestDatabase(),
  student = await addStudent(db, 20000);
let items = [],
  equippedItems = {};
async function state() {
  const owned = (
    await db.query(
      "select item_id from student_inventory where student_id=$1",
      [student],
    )
  ).rows.map((r) => r.item_id);
  const wallet = (
    await db.query("select * from student_wallets where student_id=$1", [
      student,
    ])
  ).rows[0];
  return {
    configured: true,
    items,
    ownedItemIds: owned,
    inventory: [],
    wallet: {
      studentId: student,
      academyCoins: wallet.academy_coins,
      totalCoinsSpent: wallet.total_coins_spent,
      totalCoinsEarned: 20000,
    },
    avatar: { studentId: student, equippedItems },
  };
}
export async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/__store/")
  )
    return false;
  const json = (data, status = 200) => {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    if (url.pathname === "/__store/init") {
      if (!items.length) {
        items = body;
        for (const item of items) {
          await db.query(
            "insert into avatar_items(id,name,price,category,unlock_type,is_active,rarity,asset_url,thumbnail_url) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            [
              item.id,
              item.name,
              item.price,
              item.category,
              item.unlockType,
              item.isActive,
              item.rarity,
              item.assetUrl ?? null,
              item.thumbnailUrl ?? null,
            ],
          );
          if (item.unlockType === "default") {
            await db.query(
              "insert into student_inventory(student_id,item_id,acquisition_type) values($1,$2,'default')",
              [student, item.id],
            );
            equippedItems[item.category] = item.id;
          }
        }
      }
      json({ ok: true });
    } else if (url.pathname === "/api/student/avatar/rewards") {
      if (req.method === "POST")
        json({
          receipt: await buy(db, student, body.kind, body.requestId),
          state: await state(),
        });
      else {
        const rows = (
          await db.query(
            "select * from store_reward_receipts where student_id=$1 order by created_at desc",
            [student],
          )
        ).rows;
        json({
          receipts: rows,
          availableCouponCount: rows.filter((r) => r.status === "pending")
            .length,
        });
      }
    } else if (url.pathname === "/api/admin/store-rewards") {
      if (req.method === "PATCH")
        json({ receipt: await resolveCoupon(db, body.id, body.status) });
      else {
        const rows = (
          await db.query(
            "select r.*,jsonb_build_object('display_name','Explorer') students from store_reward_receipts r where kind='free_class' order by created_at",
            [],
          )
        ).rows;
        json({
          receipts: rows.filter((r) =>
            url.searchParams.get("status") === "resolved"
              ? r.status !== "pending"
              : r.status === "pending",
          ),
        });
      }
    } else if (url.pathname === "/api/student/avatar") {
      if (req.method === "PATCH") equippedItems = body.equippedItems;
      json(await state());
    } else json({ error: "Unsupported fixture route" }, 404);
  } catch (error) {
    json({ error: error.message }, 400);
  }
  return true;
}
