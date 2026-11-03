// Real store, Trophy Case coupon and teacher controls; disposable local API only.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AvatarStudio } from "../../components/student/AvatarStudio";
import { FreeClassCoupons } from "../../components/student/FreeClassCoupons";
import { AdminStoreRewards } from "../../components/admin/AdminStoreRewards";
import { BoardAppearanceProvider } from "../../chess/appearance/BoardAppearanceProvider";
import { seedAvatarItems } from "../../lib/avatar/catalog";
const items = seedAvatarItems.map((item, i) => ({
  ...item,
  id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
}));
const nativeFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  if (String(url).includes("/board-themes"))
    return Response.json({ studentId: "store-preview", ownedThemes: [] });
  if (String(url).includes("/celebrations"))
    return Response.json({ celebrations: [] });
  return nativeFetch(url, options);
};
function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    nativeFetch("/__store/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(items),
    }).then(() => setReady(true));
  }, []);
  const view = new URLSearchParams(location.search).get("view");
  return (
    <>
      <header className="mb-6 flex flex-wrap items-center gap-5 rounded-xl border border-white/10 p-4">
        <strong>Avatar Store · local preview</strong>
        <a href="/">Store</a>
        <a href="/?view=trophies">Trophy Case</a>
        <a href="/?view=teacher">Teacher requests</a>
      </header>
      {!ready ? (
        <p>Loading…</p>
      ) : view === "teacher" ? (
        <AdminStoreRewards />
      ) : view === "trophies" ? (
        <section id="trophy-case">
          <h1 className="text-3xl font-black">Trophy Case</h1>
          <FreeClassCoupons studentId="store-preview" />
        </section>
      ) : (
        <BoardAppearanceProvider studentId="store-preview">
          <AvatarStudio />
        </BoardAppearanceProvider>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
