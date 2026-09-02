import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/logout/route";
import { TopNav } from "@/components/TopNav";

describe("teacher logout", () => {
  it("uses an explicit POST form instead of a prefetchable logout link", () => {
    const html = renderToStaticMarkup(createElement(TopNav, { variant: "admin" }));

    expect(html).toContain('action="/api/admin/logout"');
    expect(html).toContain('method="post"');
    expect(html).not.toContain('href="/api/admin/logout"');
  });

  it("clears the session and redirects a submitted form with GET semantics", async () => {
    const response = await POST(new Request("https://academy.example/api/admin/logout", { method: "POST" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://academy.example/admin-login");
    expect(response.headers.get("set-cookie")).toContain("quest_board_admin_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
