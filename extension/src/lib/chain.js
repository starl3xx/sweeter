// What a crypto address is (a wallet, a token, an NFT collection, or another
// contract), from the chain's own answers. Sweeter asks PublicNode's public
// RPC (the Mac app's "chain" message, or the Safari background script),
// which sends only these calls: eth_getCode, then for a contract the seven
// eth_calls below, in this order, and for an address with no contract
// eth_getTransactionCount and eth_getBalance; on Solana, getAccountInfo
// (jsonParsed).
// The selectors were checked with Foundry's cast, and the rules on real
// addresses (USDC, BAYC, BasePaint, vitalik.eth, Safes and ERC-4337
// accounts on Base, a Solana mint and wallet), 2026-10-15.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  // The EVM chains an untagged 0x address is checked on, in this order.
  const EVM = ['base', 'ethereum', 'arbitrum', 'optimism', 'polygon', 'bsc', 'robinhood'];
  // Answers to a contract probe: [code, erc721, erc1155, entryPoint,
  // threshold, decimals, symbol, name], each a hex string, or undefined
  // when the call failed (a revert).
  const PROBE = ['code', 'erc721', 'erc1155', 'entryPoint', 'threshold', 'decimals', 'symbol', 'name'];

  const word = (r) => (typeof r === 'string' && /^0x[0-9a-fA-F]{64}$/.test(r) ? r : null);
  // An EIP-7702 account: an ordinary wallet that delegates to code.
  const isDelegation = (code) => typeof code === 'string' && /^0xef0100[0-9a-fA-F]{40}$/i.test(code);
  const isContractCode = (code) => typeof code === 'string' && code.length > 2 && !isDelegation(code);

  // An ABI string answer (name(), symbol()), or an old bytes32 one.
  function abiString(r) {
    if (typeof r !== 'string' || !/^0x[0-9a-fA-F]*$/.test(r) || r.length < 66) return '';
    const hex = r.slice(2);
    let bytes;
    if (hex.length === 64) {
      bytes = hex.replace(/(00)+$/, '');
    } else {
      const off = parseInt(hex.slice(0, 64), 16) * 2;
      const len = parseInt(hex.slice(off, off + 64), 16) * 2;
      if (!isFinite(off) || !isFinite(len) || len > 256 || off + 64 + len > hex.length) return '';
      bytes = hex.slice(off + 64, off + 64 + len);
    }
    let s = '';
    try {
      s = decodeURIComponent(bytes.replace(/../g, '%$&'));
    } catch (e) {
      return '';
    }
    // eslint-disable-next-line no-control-regex
    return s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
  }

  // One chain's answers for one contract (see PROBE).
  function evmKind(res) {
    const at = (k) => res[PROBE.indexOf(k)];
    if (!isContractCode(at('code'))) return null;
    // An ERC-4337 account names its EntryPoint; a Safe has a threshold.
    const addr = word(at('entryPoint'));
    if (addr && /^0x0{24}/.test(addr) && !/^0x0{64}$/.test(addr)) return { kind: 'wallet', smart: 'account' };
    const t = word(at('threshold'));
    if (t && BigInt(t) >= 1n && BigInt(t) <= 1000n) return { kind: 'wallet', smart: 'Safe' };
    const yes = (r) => !!word(r) && BigInt(r) === 1n;
    const name = abiString(at('name'));
    const symbol = abiString(at('symbol'));
    if (yes(at('erc721')) || yes(at('erc1155'))) return { kind: 'nft', standard: yes(at('erc721')) ? 'ERC-721' : 'ERC-1155', name, symbol };
    const dec = word(at('decimals'));
    if (dec && BigInt(dec) <= 255n && symbol) return { kind: 'token', name, symbol };
    return { kind: 'contract', name };
  }

  // Whether an address has been used on a chain: [nonce, balance] (an
  // account's answers), true when it has sent a transaction or holds the
  // chain's coin, undefined when neither call answered.
  function used(res) {
    const n = (r) => (typeof r === 'string' && /^0x[0-9a-fA-F]+$/.test(r) ? BigInt(r) > 0n : undefined);
    const [sent, holds] = [n(res && res[0]), n(res && res[1])];
    return sent === undefined && holds === undefined ? undefined : !!(sent || holds);
  }

  // An address across the chains asked: [{ chain, code, info, used }],
  // code undefined when that chain didn't answer, info from evmKind, used
  // from used(). A wallet only when every chain answered, none has a
  // contract there, and it has been used on one (or delegates, EIP-7702):
  // an unused address with no contract may be a contract on a chain not
  // asked (a token on a new chain), so it stays unknown. Else the most
  // telling contract (a token, an NFT, a smart wallet, then any).
  function decide(per) {
    if (!per.length) return null;
    const contracts = per.filter((p) => isContractCode(p.code));
    if (!contracts.length) {
      if (per.some((p) => typeof p.code !== 'string')) return null;
      const delegated = per.some((p) => isDelegation(p.code));
      if (!delegated && !per.some((p) => p.used === true)) return null;
      return { kind: 'wallet', chains: per.map((p) => p.chain), delegated };
    }
    const rank = { token: 0, nft: 1, wallet: 2, contract: 3 };
    const known = contracts.filter((p) => p.info).sort((x, y) => rank[x.info.kind] - rank[y.info.kind]);
    if (!known.length) return null;
    return Object.assign({}, known[0].info, { chain: known[0].chain, chains: contracts.map((p) => p.chain) });
  }

  const SYSTEM = '11111111111111111111111111111111';
  const TOKEN = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
  // A Solana account (getAccountInfo's value): null when there is none
  // (unknown: an unused address, or not a Solana one at all).
  function solanaKind(v) {
    if (!v || typeof v !== 'object') return null;
    if (v.executable) return { kind: 'contract', chain: 'solana', program: true };
    if (v.owner === SYSTEM) return { kind: 'wallet', chain: 'solana', chains: ['solana'] };
    const parsed = v.data && v.data.parsed;
    if (TOKEN.includes(v.owner) && parsed && parsed.type === 'mint') {
      const info = parsed.info || {};
      return { kind: info.decimals === 0 && String(info.supply) === '1' ? 'nft' : 'token', chain: 'solana' };
    }
    return { kind: 'contract', chain: 'solana' };
  }

  Sweeter.chain = { EVM, PROBE, abiString, evmKind, used, decide, solanaKind, isDelegation, isContractCode };
})(typeof globalThis !== 'undefined' ? globalThis : this);
