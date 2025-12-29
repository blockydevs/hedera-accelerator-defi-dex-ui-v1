import { Box, Flex, useRadioGroup } from "@chakra-ui/react";
import { CreateDAOProposalForm, DAOProposalType } from "../types";
import { Color, RadioCard, SettingsToolIcon, Text } from "@shared/ui-kit";
import { useFormContext } from "react-hook-form";

const Proposals = [
  {
    title: DAOProposalType.RiskParametersProposal,
    label: "Set risk parameters (Max trade size, Max allowed slippage, Minimum seconds between trades).",
    icon: <SettingsToolIcon boxSize="4" color={Color.Grey_Blue._500} marginTop="0.2rem" />,
  },
  {
    title: DAOProposalType.AddTradingPairProposal,
    label: "Add a trading pair (Provide the address of the input/output token).",
    icon: <SettingsToolIcon boxSize="4" color={Color.Grey_Blue._500} marginTop="0.2rem" />,
  },
  {
    title: DAOProposalType.RemoveTradingPairProposal,
    label: "Remove a trading pair (Provide the address of the input/output token).",
    icon: <SettingsToolIcon boxSize="4" color={Color.Grey_Blue._500} marginTop="0.2rem" />,
  },
  {
    title: DAOProposalType.BuybackAndBurnProposal,
    label: "Buy back and burn the KAI token",
    icon: <SettingsToolIcon boxSize="4" color={Color.Grey_Blue._500} marginTop="0.2rem" />,
  },
];

export function DAOProposalTypeForm() {
  const { setValue, getValues } = useFormContext<CreateDAOProposalForm>();
  const { type } = getValues();
  const { getRootProps, getRadioProps } = useRadioGroup({
    defaultValue: type,
    onChange: handleDAOProposalSelectionChange,
  });
  const group = getRootProps();
  const dataArray = getProposalsArray();

  function handleDAOProposalSelectionChange(type: DAOProposalType) {
    setValue("type", type);
  }

  function getProposalsArray() {
    return Proposals;
  }

  return (
    <Flex direction="column" gap="4">
      <Text.P_Large_Regular>What type of proposal would you like to create?</Text.P_Large_Regular>
      <Flex flexDirection="column" gap="4" {...group}>
        {dataArray.map((option, index) => {
          const radio = getRadioProps({ value: option.title });
          return (
            <Box flex="1" key={index}>
              <RadioCard key={option.title} {...radio} padding="0.75rem">
                <Flex gap="3">
                  {option.icon}
                  <Flex flexDirection="column" gap="1">
                    <Text.P_Small_Medium color="inherit">{option.title}</Text.P_Small_Medium>
                    <Text.P_XSmall_Regular color="inherit">{option.label}</Text.P_XSmall_Regular>
                  </Flex>
                </Flex>
              </RadioCard>
            </Box>
          );
        })}
      </Flex>
    </Flex>
  );
}
