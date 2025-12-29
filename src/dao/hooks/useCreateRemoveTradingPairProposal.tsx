import { useMutation, useQueryClient } from "react-query";
import { TransactionResponse } from "@hashgraph/sdk";
import { DAOMutations, DAOQueries } from "./types";
import { HandleOnSuccess, useDexContext } from "@dex/hooks";
import DAOService from "@dao/services";
import { isNil } from "ramda";

export interface UseCreateRemoveTradingPairProposalParams {
  governorContractId: string;
  title: string;
  description: string;
  linkToDiscussion?: string;
  calldata: string;
  target: string;
  value?: number;
  governanceTokenId?: string;
  nftTokenSerialId?: number;
  daoType?: string;
}

export function useCreateRemoveTradingPairProposal(handleOnSuccess: HandleOnSuccess) {
  const queryClient = useQueryClient();
  const { wallet } = useDexContext(({ wallet }) => ({ wallet }));
  const signer = wallet.getSigner();

  return useMutation<
    TransactionResponse | undefined,
    Error,
    UseCreateRemoveTradingPairProposalParams,
    DAOMutations.CreateRemoveTradingPairProposal
  >(
    async (params: UseCreateRemoveTradingPairProposalParams) => {
      return await DAOService.sendRemoveTradingPairProposal({ ...params, signer });
    },
    {
      onSuccess: (transactionResponse: TransactionResponse | undefined) => {
        if (isNil(transactionResponse)) return;
        queryClient.invalidateQueries([DAOQueries.DAOs, DAOQueries.Proposals]);
        handleOnSuccess(transactionResponse);
      },
    }
  );
}
