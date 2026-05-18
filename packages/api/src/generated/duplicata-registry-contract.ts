import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
} from "@stellar/stellar-sdk/contract";
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

export type DataKey = {tag: "Iss", values: readonly [string]} | {tag: "Dup", values: readonly [u64]};


export interface Duplicata {
  comprovante_anexado: boolean;
  comprovante_tipo: DuplicataComprovanteTipo;
  data_emissao_unix: u64;
  data_vencimento_unix: u64;
  declaracoes_antifraude_aceitas: boolean;
  discount_eligible: boolean;
  doc_fiscal_anexado: boolean;
  doc_fiscal_chave_hash: Buffer;
  doc_fiscal_tipo: DuplicataFiscalTipo;
  id: u64;
  issued_at: u64;
  issuer: string;
  numero_duplicata_hash: Buffer;
  numero_fatura_hash: Buffer;
  sacado_commitment: Buffer;
  status_aceite_sacado: DuplicataAceiteSacado;
  tipo: DuplicataTipo;
  valor_face_centavos: i128;
  valor_max_antecipacao_centavos: i128;
}


export interface IssuePayload {
  comprovante_anexado: boolean;
  comprovante_tipo: DuplicataComprovanteTipo;
  data_emissao_unix: u64;
  data_vencimento_unix: u64;
  declaracoes_antifraude_aceitas: boolean;
  discount_eligible: boolean;
  doc_fiscal_anexado: boolean;
  doc_fiscal_chave_hash: Buffer;
  doc_fiscal_tipo: DuplicataFiscalTipo;
  numero_duplicata_hash: Buffer;
  numero_fatura_hash: Buffer;
  sacado_commitment: Buffer;
  status_aceite_sacado: DuplicataAceiteSacado;
  tipo: DuplicataTipo;
  valor_face_centavos: i128;
  valor_max_antecipacao_centavos: i128;
}

export enum DuplicataTipo {
  Mercantil = 0,
  Servico = 1,
}

export enum DuplicataFiscalTipo {
  Nfe = 0,
  Nfce = 1,
  Nfse = 2,
  Outro = 3,
}

export enum DuplicataAceiteSacado {
  Aceito = 0,
  Pendente = 1,
  Recusado = 2,
}

export enum DuplicataComprovanteTipo {
  Entrega = 0,
  Aceite = 1,
  PrestacaoServico = 2,
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
   * Construct and simulate a get_duplicata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_duplicata: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Duplicata>>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAFaXNzdWUAAAAAAAACAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAAB3BheWxvYWQAAAAH0AAAAAxJc3N1ZVBheWxvYWQAAAABAAAABg==",
        "AAAABQAAAAAAAAAAAAAAD0R1cGxpY2F0YUlzc3VlZAAAAAABAAAAEGR1cGxpY2F0YV9pc3N1ZWQAAAAHAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAEAAAAAAAAAE3ZhbG9yX2ZhY2VfY2VudGF2b3MAAAAACwAAAAAAAAAAAAAAHnZhbG9yX21heF9hbnRlY2lwYWNhb19jZW50YXZvcwAAAAAACwAAAAAAAAAAAAAAFGRhdGFfdmVuY2ltZW50b191bml4AAAABgAAAAAAAAAAAAAAEWRpc2NvdW50X2VsaWdpYmxlAAAAAAAAAQAAAAAAAAAAAAAACWlzc3VlZF9hdAAAAAAAAAYAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAHbmV4dF9pZAAAAAAAAAAAAQAAAAY=",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANZ2V0X2R1cGxpY2F0YQAAAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+gAAAfQAAAACUR1cGxpY2F0YQAAAA==",
        "AAAAAAAAAAAAAAARaXNfaXNzdWVyX2FsbG93ZWQAAAAAAAABAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAASc2V0X2lzc3Vlcl9hbGxvd2VkAAAAAAACAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAAB2FsbG93ZWQAAAAAAQAAAAA=",
        "AAAABAAAAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAAJAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAAAAAABBJc3N1ZXJOb3RBbGxvd2VkAAAABAAAAAAAAAAOSW52YWxpZEFtb3VudHMAAAAAAAUAAAAAAAAADEludmFsaWREYXRlcwAAAAYAAAAAAAAAGUZyYXVkRGVjbGFyYXRpb25zUmVxdWlyZWQAAAAAAAAHAAAAAAAAAAhOb3RGb3VuZAAAAAgAAAAAAAAAFEludmFsaWREaXNjb3VudEZsYWdzAAAACQ==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAEAAAAAAAAAA0lzcwAAAAABAAAAEwAAAAEAAAAAAAAAA0R1cAAAAAABAAAABg==",
        "AAAAAQAAAAAAAAAAAAAACUR1cGxpY2F0YQAAAAAAABMAAAAAAAAAE2NvbXByb3ZhbnRlX2FuZXhhZG8AAAAAAQAAAAAAAAAQY29tcHJvdmFudGVfdGlwbwAAB9AAAAAYRHVwbGljYXRhQ29tcHJvdmFudGVUaXBvAAAAAAAAABFkYXRhX2VtaXNzYW9fdW5peAAAAAAAAAYAAAAAAAAAFGRhdGFfdmVuY2ltZW50b191bml4AAAABgAAAAAAAAAeZGVjbGFyYWNvZXNfYW50aWZyYXVkZV9hY2VpdGFzAAAAAAABAAAAAAAAABFkaXNjb3VudF9lbGlnaWJsZQAAAAAAAAEAAAAAAAAAEmRvY19maXNjYWxfYW5leGFkbwAAAAAAAQAAAAAAAAAVZG9jX2Zpc2NhbF9jaGF2ZV9oYXNoAAAAAAAD7gAAACAAAAAAAAAAD2RvY19maXNjYWxfdGlwbwAAAAfQAAAAE0R1cGxpY2F0YUZpc2NhbFRpcG8AAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAJaXNzdWVkX2F0AAAAAAAABgAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAABVudW1lcm9fZHVwbGljYXRhX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAASbnVtZXJvX2ZhdHVyYV9oYXNoAAAAAAPuAAAAIAAAAAAAAAARc2FjYWRvX2NvbW1pdG1lbnQAAAAAAAPuAAAAIAAAAAAAAAAUc3RhdHVzX2FjZWl0ZV9zYWNhZG8AAAfQAAAAFUR1cGxpY2F0YUFjZWl0ZVNhY2FkbwAAAAAAAAAAAAAEdGlwbwAAB9AAAAANRHVwbGljYXRhVGlwbwAAAAAAAAAAAAATdmFsb3JfZmFjZV9jZW50YXZvcwAAAAALAAAAAAAAAB52YWxvcl9tYXhfYW50ZWNpcGFjYW9fY2VudGF2b3MAAAAAAAs=",
        "AAAAAQAAAAAAAAAAAAAADElzc3VlUGF5bG9hZAAAABAAAAAAAAAAE2NvbXByb3ZhbnRlX2FuZXhhZG8AAAAAAQAAAAAAAAAQY29tcHJvdmFudGVfdGlwbwAAB9AAAAAYRHVwbGljYXRhQ29tcHJvdmFudGVUaXBvAAAAAAAAABFkYXRhX2VtaXNzYW9fdW5peAAAAAAAAAYAAAAAAAAAFGRhdGFfdmVuY2ltZW50b191bml4AAAABgAAAAAAAAAeZGVjbGFyYWNvZXNfYW50aWZyYXVkZV9hY2VpdGFzAAAAAAABAAAAAAAAABFkaXNjb3VudF9lbGlnaWJsZQAAAAAAAAEAAAAAAAAAEmRvY19maXNjYWxfYW5leGFkbwAAAAAAAQAAAAAAAAAVZG9jX2Zpc2NhbF9jaGF2ZV9oYXNoAAAAAAAD7gAAACAAAAAAAAAAD2RvY19maXNjYWxfdGlwbwAAAAfQAAAAE0R1cGxpY2F0YUZpc2NhbFRpcG8AAAAAAAAAABVudW1lcm9fZHVwbGljYXRhX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAASbnVtZXJvX2ZhdHVyYV9oYXNoAAAAAAPuAAAAIAAAAAAAAAARc2FjYWRvX2NvbW1pdG1lbnQAAAAAAAPuAAAAIAAAAAAAAAAUc3RhdHVzX2FjZWl0ZV9zYWNhZG8AAAfQAAAAFUR1cGxpY2F0YUFjZWl0ZVNhY2FkbwAAAAAAAAAAAAAEdGlwbwAAB9AAAAANRHVwbGljYXRhVGlwbwAAAAAAAAAAAAATdmFsb3JfZmFjZV9jZW50YXZvcwAAAAALAAAAAAAAAB52YWxvcl9tYXhfYW50ZWNpcGFjYW9fY2VudGF2b3MAAAAAAAs=",
        "AAAAAwAAAAAAAAAAAAAADUR1cGxpY2F0YVRpcG8AAAAAAAACAAAAAAAAAAlNZXJjYW50aWwAAAAAAAAAAAAAAAAAAAdTZXJ2aWNvAAAAAAE=",
        "AAAAAwAAAAAAAAAAAAAAE0R1cGxpY2F0YUZpc2NhbFRpcG8AAAAABAAAAAAAAAADTmZlAAAAAAAAAAAAAAAABE5mY2UAAAABAAAAAAAAAAROZnNlAAAAAgAAAAAAAAAFT3V0cm8AAAAAAAAD",
        "AAAAAwAAAAAAAAAAAAAAFUR1cGxpY2F0YUFjZWl0ZVNhY2FkbwAAAAAAAAMAAAAAAAAABkFjZWl0bwAAAAAAAAAAAAAAAAAIUGVuZGVudGUAAAABAAAAAAAAAAhSZWN1c2FkbwAAAAI=",
        "AAAAAwAAAAAAAAAAAAAAGER1cGxpY2F0YUNvbXByb3ZhbnRlVGlwbwAAAAMAAAAAAAAAB0VudHJlZ2EAAAAAAAAAAAAAAAAGQWNlaXRlAAAAAAABAAAAAAAAABBQcmVzdGFjYW9TZXJ2aWNvAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<Option<string>>,
        issue: this.txFromJSON<u64>,
        next_id: this.txFromJSON<u64>,
        set_admin: this.txFromJSON<null>,
        initialize: this.txFromJSON<null>,
        get_duplicata: this.txFromJSON<Option<Duplicata>>,
        is_issuer_allowed: this.txFromJSON<boolean>,
        set_issuer_allowed: this.txFromJSON<null>
  }
}