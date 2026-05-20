import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type { ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";

export const RegistryError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"IssuerNotAllowed"},
  5: {message:"InvalidAmounts"},
  6: {message:"InvalidDates"},
  7: {message:"FraudDeclarationsRequired"},
  8: {message:"NotFound"},
  9: {message:"InvalidDiscountFlags"}
}

export type DataKey = {tag: "Iss", values: readonly [string]} | {tag: "Rec", values: readonly [u64]};

export enum BillKind {
  Commercial = 0,
  Service = 1,
}


export interface TradeBill {
  discount_eligible: boolean;
  draft_number_hash: Buffer;
  drawee_acceptance: DraweeAcceptance;
  drawee_commitment: Buffer;
  due_date_unix: u64;
  evidence_attached: boolean;
  evidence_kind: EvidenceKind;
  face_value_cents: i128;
  fiscal_doc_attached: boolean;
  fiscal_doc_key_hash: Buffer;
  fiscal_doc_kind: FiscalDocKind;
  fraud_declarations_accepted: boolean;
  id: u64;
  invoice_number_hash: Buffer;
  issue_date_unix: u64;
  issued_at: u64;
  issuer: string;
  kind: BillKind;
  max_advance_value_cents: i128;
}

export enum EvidenceKind {
  Delivery = 0,
  Acceptance = 1,
  ServicePerformed = 2,
}


export interface IssuePayload {
  discount_eligible: boolean;
  draft_number_hash: Buffer;
  drawee_acceptance: DraweeAcceptance;
  drawee_commitment: Buffer;
  due_date_unix: u64;
  evidence_attached: boolean;
  evidence_kind: EvidenceKind;
  face_value_cents: i128;
  fiscal_doc_attached: boolean;
  fiscal_doc_key_hash: Buffer;
  fiscal_doc_kind: FiscalDocKind;
  fraud_declarations_accepted: boolean;
  invoice_number_hash: Buffer;
  issue_date_unix: u64;
  kind: BillKind;
  max_advance_value_cents: i128;
}

export enum FiscalDocKind {
  Nfe = 0,
  Nfce = 1,
  Nfse = 2,
  Other = 3,
}

export enum DraweeAcceptance {
  Accepted = 0,
  Pending = 1,
  Rejected = 2,
}

export interface Client {
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a issue transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  issue: ({issuer, payload}: {issuer: string, payload: IssuePayload}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a next_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  next_id: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_trade_bill transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_trade_bill: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<TradeBill>>>

  /**
   * Construct and simulate a is_issuer_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_issuer_allowed: ({issuer}: {issuer: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_issuer_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_issuer_allowed: ({issuer, allowed}: {issuer: string, allowed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABQAAAAAAAAAAAAAAD1RyYWRlQmlsbElzc3VlZAAAAAABAAAAEXRyYWRlX2JpbGxfaXNzdWVkAAAAAAAABwAAAAAAAAACaWQAAAAAAAYAAAABAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAABAAAAAAAAABBmYWNlX3ZhbHVlX2NlbnRzAAAACwAAAAAAAAAAAAAAF21heF9hZHZhbmNlX3ZhbHVlX2NlbnRzAAAAAAsAAAAAAAAAAAAAAA1kdWVfZGF0ZV91bml4AAAAAAAABgAAAAAAAAAAAAAAEWRpc2NvdW50X2VsaWdpYmxlAAAAAAAAAQAAAAAAAAAAAAAACWlzc3VlZF9hdAAAAAAAAAYAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAFaXNzdWUAAAAAAAACAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAAB3BheWxvYWQAAAAH0AAAAAxJc3N1ZVBheWxvYWQAAAABAAAABg==",
        "AAAAAAAAAAAAAAAHbmV4dF9pZAAAAAAAAAAAAQAAAAY=",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAOZ2V0X3RyYWRlX2JpbGwAAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+gAAAfQAAAACVRyYWRlQmlsbAAAAA==",
        "AAAAAAAAAAAAAAARaXNfaXNzdWVyX2FsbG93ZWQAAAAAAAABAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAASc2V0X2lzc3Vlcl9hbGxvd2VkAAAAAAACAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAAB2FsbG93ZWQAAAAAAQAAAAA=",
        "AAAABAAAAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAAJAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAAAAAABBJc3N1ZXJOb3RBbGxvd2VkAAAABAAAAAAAAAAOSW52YWxpZEFtb3VudHMAAAAAAAUAAAAAAAAADEludmFsaWREYXRlcwAAAAYAAAAAAAAAGUZyYXVkRGVjbGFyYXRpb25zUmVxdWlyZWQAAAAAAAAHAAAAAAAAAAhOb3RGb3VuZAAAAAgAAAAAAAAAFEludmFsaWREaXNjb3VudEZsYWdzAAAACQ==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAEAAAAAAAAAA0lzcwAAAAABAAAAEwAAAAEAAAAAAAAAA1JlYwAAAAABAAAABg==",
        "AAAAAwAAAAAAAAAAAAAACEJpbGxLaW5kAAAAAgAAAAAAAAAKQ29tbWVyY2lhbAAAAAAAAAAAAAAAAAAHU2VydmljZQAAAAAB",
        "AAAAAQAAAAAAAAAAAAAACVRyYWRlQmlsbAAAAAAAABMAAAAAAAAAEWRpc2NvdW50X2VsaWdpYmxlAAAAAAAAAQAAAAAAAAARZHJhZnRfbnVtYmVyX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAARZHJhd2VlX2FjY2VwdGFuY2UAAAAAAAfQAAAAEERyYXdlZUFjY2VwdGFuY2UAAAAAAAAAEWRyYXdlZV9jb21taXRtZW50AAAAAAAD7gAAACAAAAAAAAAADWR1ZV9kYXRlX3VuaXgAAAAAAAAGAAAAAAAAABFldmlkZW5jZV9hdHRhY2hlZAAAAAAAAAEAAAAAAAAADWV2aWRlbmNlX2tpbmQAAAAAAAfQAAAADEV2aWRlbmNlS2luZAAAAAAAAAAQZmFjZV92YWx1ZV9jZW50cwAAAAsAAAAAAAAAE2Zpc2NhbF9kb2NfYXR0YWNoZWQAAAAAAQAAAAAAAAATZmlzY2FsX2RvY19rZXlfaGFzaAAAAAPuAAAAIAAAAAAAAAAPZmlzY2FsX2RvY19raW5kAAAAB9AAAAANRmlzY2FsRG9jS2luZAAAAAAAAAAAAAAbZnJhdWRfZGVjbGFyYXRpb25zX2FjY2VwdGVkAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAAAAABNpbnZvaWNlX251bWJlcl9oYXNoAAAAA+4AAAAgAAAAAAAAAA9pc3N1ZV9kYXRlX3VuaXgAAAAABgAAAAAAAAAJaXNzdWVkX2F0AAAAAAAABgAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAARraW5kAAAH0AAAAAhCaWxsS2luZAAAAAAAAAAXbWF4X2FkdmFuY2VfdmFsdWVfY2VudHMAAAAACw==",
        "AAAAAwAAAAAAAAAAAAAADEV2aWRlbmNlS2luZAAAAAMAAAAAAAAACERlbGl2ZXJ5AAAAAAAAAAAAAAAKQWNjZXB0YW5jZQAAAAAAAQAAAAAAAAAQU2VydmljZVBlcmZvcm1lZAAAAAI=",
        "AAAAAQAAAAAAAAAAAAAADElzc3VlUGF5bG9hZAAAABAAAAAAAAAAEWRpc2NvdW50X2VsaWdpYmxlAAAAAAAAAQAAAAAAAAARZHJhZnRfbnVtYmVyX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAARZHJhd2VlX2FjY2VwdGFuY2UAAAAAAAfQAAAAEERyYXdlZUFjY2VwdGFuY2UAAAAAAAAAEWRyYXdlZV9jb21taXRtZW50AAAAAAAD7gAAACAAAAAAAAAADWR1ZV9kYXRlX3VuaXgAAAAAAAAGAAAAAAAAABFldmlkZW5jZV9hdHRhY2hlZAAAAAAAAAEAAAAAAAAADWV2aWRlbmNlX2tpbmQAAAAAAAfQAAAADEV2aWRlbmNlS2luZAAAAAAAAAAQZmFjZV92YWx1ZV9jZW50cwAAAAsAAAAAAAAAE2Zpc2NhbF9kb2NfYXR0YWNoZWQAAAAAAQAAAAAAAAATZmlzY2FsX2RvY19rZXlfaGFzaAAAAAPuAAAAIAAAAAAAAAAPZmlzY2FsX2RvY19raW5kAAAAB9AAAAANRmlzY2FsRG9jS2luZAAAAAAAAAAAAAAbZnJhdWRfZGVjbGFyYXRpb25zX2FjY2VwdGVkAAAAAAEAAAAAAAAAE2ludm9pY2VfbnVtYmVyX2hhc2gAAAAD7gAAACAAAAAAAAAAD2lzc3VlX2RhdGVfdW5peAAAAAAGAAAAAAAAAARraW5kAAAH0AAAAAhCaWxsS2luZAAAAAAAAAAXbWF4X2FkdmFuY2VfdmFsdWVfY2VudHMAAAAACw==",
        "AAAAAwAAAAAAAAAAAAAADUZpc2NhbERvY0tpbmQAAAAAAAAEAAAAAAAAAANOZmUAAAAAAAAAAAAAAAAETmZjZQAAAAEAAAAAAAAABE5mc2UAAAACAAAAAAAAAAVPdGhlcgAAAAAAAAM=",
        "AAAAAwAAAAAAAAAAAAAAEERyYXdlZUFjY2VwdGFuY2UAAAADAAAAAAAAAAhBY2NlcHRlZAAAAAAAAAAAAAAAB1BlbmRpbmcAAAAAAQAAAAAAAAAIUmVqZWN0ZWQAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<Option<string>>,
        issue: this.txFromJSON<u64>,
        next_id: this.txFromJSON<u64>,
        set_admin: this.txFromJSON<null>,
        initialize: this.txFromJSON<null>,
        get_trade_bill: this.txFromJSON<Option<TradeBill>>,
        is_issuer_allowed: this.txFromJSON<boolean>,
        set_issuer_allowed: this.txFromJSON<null>
  }
}