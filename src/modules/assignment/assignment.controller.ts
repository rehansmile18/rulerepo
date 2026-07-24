import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter, assertCanWriteClient } from "../../middleware/tenantScope";
import * as assignmentService from "./assignment.service";
import { CreateAssignmentInput, UpdateAssignmentInput } from "./assignment.validators";

export const listAssignmentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { ruleGroupId, page, pageSize } = req.query as unknown as { ruleGroupId?: string; page: number; pageSize: number };
  const result = await assignmentService.listAssignments(getReadClientFilter(req), ruleGroupId, page, pageSize);
  res.json(result);
});

export const getAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await assignmentService.getAssignment(req.params.assignmentId, getReadClientFilter(req));
  res.json(doc);
});

export const createAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateAssignmentInput;
  assertCanWriteClient(req, input.clientId);
  const doc = await assignmentService.createAssignment(input, req.auth!.userId);
  res.status(201).json(doc);
});

export const updateAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await assignmentService.getAssignment(req.params.assignmentId, getReadClientFilter(req));
  assertCanWriteClient(req, String(existing.clientId));
  const doc = await assignmentService.updateAssignment(
    req.params.assignmentId,
    req.body as UpdateAssignmentInput,
    getReadClientFilter(req),
    req.auth!.userId
  );
  res.json(doc);
});

interface ResolveQuery {
  clientId: string;
  employeeId: string;
  date: Date;
  paygroupId?: string;
  locationId?: string;
  departmentId?: string;
  state?: string;
}

export const resolveAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const { clientId, employeeId, date, paygroupId, locationId, departmentId, state } = req.query as unknown as ResolveQuery;
  assertCanWriteClient(req, clientId); // resolve is a read, but still tenant-scoped to the caller's own client
  const result = await assignmentService.resolveAssignment({ clientId, employeeId, date, paygroupId, locationId, departmentId, state });
  res.json(result);
});

export const resolveAssignmentLayeredHandler = asyncHandler(async (req: Request, res: Response) => {
  const { clientId, employeeId, date, paygroupId, locationId, departmentId, state } = req.query as unknown as ResolveQuery;
  assertCanWriteClient(req, clientId); // same tenant-scoping as the single-winner resolve endpoint
  const result = await assignmentService.resolveAssignmentLayered({ clientId, employeeId, date, paygroupId, locationId, departmentId, state });
  res.json(result);
});
