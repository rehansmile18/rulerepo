import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter, assertCanWriteClient } from "../../middleware/tenantScope";
import * as ruleGroupService from "./ruleGroup.service";
import { CreateRuleGroupInput, UpdateRuleGroupInput } from "./ruleGroup.validators";

export const listRuleGroupsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, pageSize } = req.query as unknown as { status?: string; page: number; pageSize: number };
  const result = await ruleGroupService.listRuleGroups(getReadClientFilter(req), status, page, pageSize);
  res.json(result);
});

export const getRuleGroupHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ruleGroupService.getRuleGroup(req.params.ruleGroupId, getReadClientFilter(req));
  res.json(doc);
});

export const createRuleGroupHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateRuleGroupInput;
  assertCanWriteClient(req, input.clientId);
  const doc = await ruleGroupService.createRuleGroup(input, req.auth!.userId);
  res.status(201).json(doc);
});

export const updateRuleGroupHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await ruleGroupService.getRuleGroup(req.params.ruleGroupId, getReadClientFilter(req));
  assertCanWriteClient(req, String(existing.clientId));
  const doc = await ruleGroupService.updateRuleGroup(
    req.params.ruleGroupId,
    req.body as UpdateRuleGroupInput,
    getReadClientFilter(req),
    req.auth!.userId
  );
  res.json(doc);
});

export const publishRuleGroupHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await ruleGroupService.getRuleGroup(req.params.ruleGroupId, getReadClientFilter(req));
  assertCanWriteClient(req, String(existing.clientId));
  const doc = await ruleGroupService.publishRuleGroup(req.params.ruleGroupId, getReadClientFilter(req), req.auth!.userId);
  res.json(doc);
});

export const archiveRuleGroupHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await ruleGroupService.getRuleGroup(req.params.ruleGroupId, getReadClientFilter(req));
  assertCanWriteClient(req, String(existing.clientId));
  const doc = await ruleGroupService.archiveRuleGroup(req.params.ruleGroupId, getReadClientFilter(req), req.auth!.userId);
  res.json(doc);
});
