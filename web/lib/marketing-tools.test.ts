import { test } from "node:test";
import assert from "node:assert/strict";
import { registerMarketingReadTools, registerMarketingTools } from "./marketing-tools";
import { MemoryKV, Store } from "./store";

function names(register: (server: any) => void) {
  const got: string[] = [];
  register({ registerTool: (name: string) => got.push(name) });
  return got.sort();
}

const deps = () => ({ graph: {} as any, store: new Store(new MemoryKV()), cfg: {} as any });

const FULL = ["campaign_advance", "campaign_control", "campaign_dry_run", "campaign_report", "campaign_start", "create_template", "delete_template", "get_template_status", "list_campaigns", "list_opt_outs", "manage_opt_out", "register_number"];

test("full key without the CRM flag keeps the same tool set", () => {
  assert.deepEqual(names((s) => registerMarketingTools(s, deps())), FULL);
});

test("CRM flag adds only two read tools", () => {
  assert.deepEqual(names((s) => registerMarketingTools(s, deps(), { crm: true })), [...FULL, "campaign_recipients", "check_opt_outs"].sort());
});

test("read set has no tool that can send or change anything", () => {
  assert.deepEqual(names((s) => registerMarketingReadTools(s, deps())), ["campaign_report", "list_campaigns", "list_opt_outs"]);
  assert.deepEqual(names((s) => registerMarketingReadTools(s, deps(), { crm: true })), ["campaign_recipients", "campaign_report", "check_opt_outs", "list_campaigns", "list_opt_outs"]);
});
