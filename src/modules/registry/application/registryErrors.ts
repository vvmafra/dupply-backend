/** Re-export blockchain registry errors for HTTP mapping in the registry API. */
export {
  DomainValidationError,
  IssuerNotAllowedError,
  IssueSimulationError,
  RegistryConfigError,
} from "../../../infra/blockchain/stellar/registry/issue-flow.js";
export {
  TxFailedError,
  TxNotFoundError,
} from "../../../infra/blockchain/stellar/registry/confirm-tx.js";
