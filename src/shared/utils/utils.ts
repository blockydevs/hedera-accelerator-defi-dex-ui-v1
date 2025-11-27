import { TokenType, TokenId, AccountId, LedgerId } from "@hashgraph/sdk";

export const halfOf = (amount: number) => amount / 2;

export const isNFT = (tokenType: string = "") => {
  return tokenType === TokenType.NonFungibleUnique.toString();
};

export const isFungible = (tokenType: string = "") => {
  return tokenType === TokenType.FungibleCommon.toString();
};

export const solidityAddressToTokenIdString = (address: string): string => {
  try {
    return TokenId.fromSolidityAddress(address).toString();
  } catch {
    return address;
  }
};

export const solidityAddressToAccountIdString = (address: string): string => {
  try {
    return AccountId.fromEvmAddress(0, 0, address).toString();
  } catch {
    return address;
  }
};

export function getDefaultLedgerId() {
  const networkFromEnv = import.meta.env.VITE_NETWORK?.toLowerCase();

  // Use environment variable if set, otherwise fallback to TESTNET
  if (networkFromEnv === "mainnet") {
    return LedgerId.MAINNET;
  }

  return LedgerId.TESTNET;
}
