import { UseMutationResult } from "react-query";
import { DAOMutations } from "./types";
import { TransactionResponse } from "@hashgraph/sdk";

export type UseApproveProposalMutationResult = UseMutationResult<
  TransactionResponse | undefined,
  Error,
  UseApproveProposalParams,
  DAOMutations.ApproveProposal
>;

interface UseApproveProposalParams {
  safeId: string;
  transactionHash: string;
}
