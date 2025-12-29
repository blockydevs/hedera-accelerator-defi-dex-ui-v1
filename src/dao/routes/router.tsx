import { Flex } from "@chakra-ui/react";
import { createHashRouter, createRoutesFromElements, Navigate, Route } from "react-router-dom";
import { AppLayout, NotFound } from "@dex/layouts";
import { Routes } from "./routes";
import * as Pages from "@dao/pages";
import { DEFAULT_DAO_OVERVIEW_PATH } from "@dao/config/singleDao";

export const router = createHashRouter(
  createRoutesFromElements(
    <Route path={Routes.Home} element={<AppLayout navOptions={[]} brandText="KairosDAO" />}>
      <Route index element={<Navigate to={DEFAULT_DAO_OVERVIEW_PATH} />} />
      {
        <Route path={Routes.CreateDAOProposal} element={<Pages.CreateDAOProposal />}>
          <Route index element={<Navigate to={Routes.DAOProposalType} replace />} />
          <Route path={Routes.DAOProposalType} element={<Pages.DAOProposalTypeForm />} />
          <Route path={Routes.DAOKairosDetails} element={<Pages.DAODetailsForm />} />
          <Route path={Routes.DAORiskParamsDetails} element={<Pages.DAORiskParamsDetailsForm />} />
          <Route path={Routes.DAOAddTradingPairDetails} element={<Pages.DAOAddTradingPairForm />} />
          <Route path={Routes.DAORemoveTradingPairDetails} element={<Pages.DAORemoveTradingPairForm />} />
          <Route path={Routes.DAORiskParamsReview} element={<Pages.DAORiskParamsReviewForm />} />
          <Route path={Routes.DAOTradingPairReview} element={<Pages.DAOTradingPairReviewForm />} />
          <Route path={Routes.DAOBuybackAndBurnDetails} element={<Pages.DAOBuybackAndBurnForm />} />
          <Route path={Routes.DAOBuybackAndBurnReview} element={<Pages.DAOBuybackAndBurnReviewForm />} />
        </Route>
      }
      {<Route path={`${Routes.Proposals}/:transactionHash`} element={<Pages.GovernanceProposalDetailsPage />} />}
      {
        <Route element={<Pages.GovernanceDAODashboard />}>
          <Route index element={<Navigate to={Routes.Overview} />} />
          <Route path={Routes.Overview} element={<Pages.GovernanceDAODashboardOverview />} />
          <Route path={Routes.Proposals} element={<Pages.GovernanceDAOProposalList />} />
          <Route path={Routes.Assets} element={<Pages.AssetsList />} />
          <Route path={Routes.Staking} element={<NotFound message={`The staking page is under construction`} />} />
          <Route path={Routes.Members} element={<Pages.MembersList />} />
          <Route path={Routes.Settings} element={<Pages.DAOSettings />} />
        </Route>
      }
      <Route
        path="*"
        element={
          <Flex width="100%" height="70vh" justifyContent="center" alignItems="center">
            <NotFound message={`Page not found.`} />
          </Flex>
        }
      />
    </Route>
  )
);
