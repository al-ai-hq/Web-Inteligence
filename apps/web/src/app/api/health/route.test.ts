import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { setAuditServicesForTests, type AuditServices } from "../../../services/container";

afterEach(() => {
  setAuditServicesForTests(null);
});

describe("GET /api/health", () => {
  it("returns 200 ok without a database pool", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("pings the database when a pool is available", async () => {
    let pinged = false;
    const fakeServices = {
      pool: {
        query: async (sql: string) => {
          pinged = true;
          expect(sql).toBe("SELECT 1");
          return { rows: [{ one: 1 }] };
        },
      },
    } as unknown as AuditServices;

    setAuditServicesForTests(fakeServices);

    const response = await GET(new NextRequest("http://localhost:3000/api/health"));
    expect(response.status).toBe(200);
    expect(pinged).toBe(true);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
