import { getDefaultLedgerId } from "shared";
import contractsUAT from "./contractsUAT.json";
import contractsMainnet from "./contractsMainnet.json";

interface ContractMetaData {
  name: string;
  id: string;
  address: string;
  timestamp: string;
  hash: string;
  transparentProxyAddress?: string;
  transparentProxyId?: string;
}

enum ContractNames {
  Factory = "factory",
  GodHolder = "godholder",
  GovernorContractUpgrade = "governorupgrade",
  GovernorTransferToken = "governortransfertoken",
  GovernorTextProposal = "governortextproposal",
  GovernorCreateToken = "governortokencreate",
  Configuration = "configuration",
  FTDAOFactory = "ftdaofactory",
  MultiSigDAOFactory = "multisigdaofactory",
  NFTDAOFactory = "nftdaofactory",
  SystemRoleBasedAccess = "systemrolebasedaccess",
}

function getProxyId(contractName: ContractNames): string {
  const activeNetwork = getDefaultLedgerId();

  return (
    (activeNetwork.toString() === "mainnet" ? contractsMainnet : contractsUAT).find(
      (contract: ContractMetaData) => contract.name === contractName
    )?.transparentProxyId ?? ""
  );
}

export const Contracts = {
  Factory: {
    ProxyId: getProxyId(ContractNames.Factory),
  },
  Governor: {
    ContractUpgrade: {
      ProxyId: getProxyId(ContractNames.GovernorContractUpgrade),
    },
    TransferToken: {
      ProxyId: getProxyId(ContractNames.GovernorTransferToken),
    },
    TextProposal: {
      ProxyId: getProxyId(ContractNames.GovernorTextProposal),
    },
    CreateToken: {
      ProxyId: getProxyId(ContractNames.GovernorCreateToken),
    },
  },
  FTDAOFactory: {
    ProxyId: getProxyId(ContractNames.FTDAOFactory),
  },
  GODHolder: {
    ProxyId: getProxyId(ContractNames.GodHolder),
  },
  Configuration: {
    ProxyId: getProxyId(ContractNames.Configuration),
  },
  MultiSigDAOFactory: {
    ProxyId: getProxyId(ContractNames.MultiSigDAOFactory),
  },
  NFTDAOFactory: {
    ProxyId: getProxyId(ContractNames.NFTDAOFactory),
  },
  SystemRoleBasedAccess: {
    ProxyId: getProxyId(ContractNames.SystemRoleBasedAccess),
  },
};

/** The "hashconnectData" is the string used by the hashconnect lib to modify localStorage */
export const WALLET_LOCAL_DATA_KEY = "hashconnectData";

export const TREASURY_ID = "0.0.2948681";
export const TOKEN_USER_ID = "0.0.3418035";
export const DEX_TOKEN_PRECISION_VALUE = 8;
export const DEBOUNCE_TIME = 500;
export const GovernanceTokenId = "0.0.3418196";

export const HBARTokenId = "0.0.3418197";
export const HBARTokenId_MAINNET = "0.0.0";
export const HBARTokenSymbol = "HBAR";
export const HBARSymbol = "ℏ";
export const DEFAULT_NFT_TOKEN_SERIAL_ID = 0;
export const MINIMUM_DEPOSIT_AMOUNT = 1;

export const Gas = 9000000;
export const GasPrice = 100000000;

export const DAOsPerPage = 30;
