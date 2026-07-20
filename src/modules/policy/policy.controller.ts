import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertCanWriteClient, assertCanWriteGlobal, requireClientId } from "../../middleware/tenantScope";
import { BadRequestError } from "../../utils/errors";
import * as policyService from "./policy.service";
import { CreatePolicyInput, UpdatePolicyInput } from "./policy.validators";

export const listPoliciesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { policyType, clientId, scope, state, status, effectiveOn, page, pageSize } = req.query as unknown as {
    policyType?: string;
    clientId?: string;
    scope?: string;
    state?: string;
    status?: string;
    effectiveOn?: Date;
    page: number;
    pageSize: number;
  };
  const tenantFilter = getGlobalOrOwnFilter(req);
  const result = await policyService.listPolicies(
    {
      tenantFilter,
      policyType: policyType as never,
      clientId,
      scope: scope as never,
      state,
      status,
      effectiveOn,
    },
    page,
    pageSize
  );
  res.json(result);
});

export const getPolicyHandler = asyncHandler(async (req: Request, res: Response) => {
  let version: number | undefined;
  if (req.query.version !== undefined) {
    version = Number(req.query.version);
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestError("version must be a positive integer");
    }
  }
  const doc = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req), version);
  res.json(doc);
});

export const getPolicyVersionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const docs = await policyService.getPolicyVersions(req.params.policyId, getGlobalOrOwnFilter(req));
  res.json({ items: docs });
});

export const createPolicyHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreatePolicyInput;
  if (input.scope === "global") {
    assertCanWriteGlobal(req);
  } else {
    assertCanWriteClient(req, requireClientId(input.clientId));
  }
  const doc = await policyService.createPolicy(input, req.auth!.userId);
  res.status(201).json(doc);
});

export const updatePolicyHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req));
  authorizeWriteForExistingPolicy(req, existing);
  const doc = await policyService.updatePolicy(req.params.policyId, req.body as UpdatePolicyInput, getGlobalOrOwnFilter(req), req.auth!.userId);
  res.json(doc);
});

export const publishPolicyHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req));
  authorizeWriteForExistingPolicy(req, existing);
  const doc = await policyService.publishPolicy(req.params.policyId, getGlobalOrOwnFilter(req), req.auth!.userId);
  res.json(doc);
});

export const submitPolicyForApprovalHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req));
  authorizeWriteForExistingPolicy(req, existing);
  const doc = await policyService.submitPolicyForApproval(req.params.policyId, getGlobalOrOwnFilter(req), req.auth!.userId);
  res.json(doc);
});

export const approvePolicyHandler = asyncHandler(async (req: Request, res: Response) => {
  assertCanWriteGlobal(req); // approval is always a platform-admin (compliance) function
  const doc = await policyService.approvePolicy(req.params.policyId, getGlobalOrOwnFilter(req), req.auth!.userId);
  res.json(doc);
});

export const rejectPolicyHandler = asyncHandler(async (req: Request, res: Response) => {
  assertCanWriteGlobal(req);
  const { reason } = req.body as { reason?: string };
  const doc = await policyService.rejectPolicy(req.params.policyId, getGlobalOrOwnFilter(req), req.auth!.userId, reason);
  res.json(doc);
});

export const archivePolicyHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req));
  authorizeWriteForExistingPolicy(req, existing);
  const doc = await policyService.archivePolicy(req.params.policyId, getGlobalOrOwnFilter(req), req.auth!.userId);
  res.json(doc);
});

export const clonePolicyHandler = asyncHandler(async (req: Request, res: Response) => {
  const { clientId, effectiveFrom } = req.body as { clientId: string; effectiveFrom?: Date };
  assertCanWriteClient(req, requireClientId(clientId));
  const doc = await policyService.clonePolicy(req.params.policyId, clientId, req.auth!.userId, effectiveFrom);
  res.status(201).json(doc);
});

// A caller may read: their own client's policies, or any global policy.
function getGlobalOrOwnFilter(req: Request): Record<string, unknown> {
  if (req.auth?.role === "PLATFORM_ADMIN") return {};
  return { $or: [{ scope: "global" }, { clientId: req.auth?.clientId }] };
}

function authorizeWriteForExistingPolicy(req: Request, existing: { scope: string; clientId: unknown }): void {
  if (existing.scope === "global") {
    assertCanWriteGlobal(req);
  } else {
    assertCanWriteClient(req, String(existing.clientId));
  }
}
