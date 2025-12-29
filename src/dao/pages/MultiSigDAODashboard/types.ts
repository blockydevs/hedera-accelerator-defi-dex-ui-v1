import { TokenBalance } from "@dex/hooks";
import { Member, MultiSigDAODetails } from "@dao/services";

export type MultiSigDAODetailsContext = {
  dao: MultiSigDAODetails;
  tokenBalances: TokenBalance[];
  members: Member[];
  totalAssetValue: number;
};

export enum DepositTokenModalTabs {
  Fungible = 0,
  NFT,
}
