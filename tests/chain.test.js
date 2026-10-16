// What an address is, from the chain's own answers (lib/chain.js). The
// answers in chain-answers.json are real, from PublicNode on 2026-10-15
// and 16 (a contract's code cut to its start; null where the call reverted).
const C = globalThis.Sweeter.chain;
const A = require('./chain-answers.json');
const kind = (res) => C.evmKind(res.map((x) => (x === null ? undefined : x)));

test('chain: a contract is a token, an NFT, a smart wallet, or another contract', () => {
  eq(kind(A.usdcBase), { kind: 'token', name: 'USD Coin', symbol: 'USDC' });
  eq(kind(A.baycEthereum), { kind: 'nft', standard: 'ERC-721', name: 'BoredApeYachtClub', symbol: 'BAYC' });
  eq(kind(A.basePaintBase).standard, 'ERC-1155');
  eq(kind(A.safeBase), { kind: 'wallet', smart: 'Safe' });
  eq(kind(A.account4337Base), { kind: 'wallet', smart: 'account' });
  eq(kind(A.ensDaoEthereum).kind, 'contract');
  // An EIP-7702 account is a wallet, whatever its delegate answers.
  eq(kind(A.vitalikEthereum), null);
  ok(C.isDelegation(A.vitalikEthereum[0]) && !C.isContractCode(A.vitalikEthereum[0]));
});

test('chain: a wallet only when every chain answered with no contract, and it was used', () => {
  eq(C.decide([{ chain: 'base', code: '0x' }, { chain: 'ethereum', code: A.vitalikEthereum[0] }]), { kind: 'wallet', chains: ['base', 'ethereum'], delegated: true });
  eq([C.used(A.vitalikAccountEthereum), C.used(A.sportsAccountBase), C.used([undefined, undefined]), C.used(['0x0', undefined])], [true, false, undefined, false]);
  const plain = { chain: 'base', code: '0x', used: C.used(A.sportsAccountBase) };
  eq(C.decide([plain, { chain: 'ethereum', code: '0x', used: C.used(A.vitalikAccountEthereum) }]).kind, 'wallet', 'used on one chain');
  // $SPORTS's address (vibe.market, 2026-10-16): no code and never used on
  // Base or Ethereum, because it is a token on Robinhood Chain.
  eq(C.decide([plain, { chain: 'ethereum', code: '0x', used: false }]), null, 'unused everywhere asked: may be a contract elsewhere');
  eq(C.decide([plain, { chain: 'ethereum', code: '0x' }]), null, 'no answer about its use');
  const sports = { chain: 'robinhood', code: A.sportsRobinhood[0], info: kind(A.sportsRobinhood) };
  eq(sports.info, { kind: 'token', name: 'Sports', symbol: 'SPORTS' }, 'an EIP-1167 clone still answers as a token');
  const d0 = C.decide([plain, { chain: 'ethereum', code: '0x', used: false }, sports]);
  eq([d0.kind, d0.symbol, d0.chain], ['token', 'SPORTS', 'robinhood']);
  ok(C.EVM.includes('robinhood'));
  eq(C.decide([{ chain: 'base', code: '0x' }, { chain: 'ethereum', code: undefined }]), null, 'a chain that did not answer');
  eq(C.decide([]), null);
  // A contract somewhere wins, and the most telling one leads.
  const token = { chain: 'ethereum', code: '0x6080', info: kind(A.usdcBase) };
  const other = { chain: 'base', code: '0x6080', info: kind(A.ensDaoEthereum) };
  const d = C.decide([other, token, { chain: 'arbitrum', code: '0x' }]);
  eq([d.kind, d.symbol, d.chain, d.chains], ['token', 'USDC', 'ethereum', ['base', 'ethereum']]);
  eq(C.decide([{ chain: 'base', code: '0x6080', info: null }]), null, 'a contract whose look failed');
});

test('chain: Solana accounts', () => {
  eq(C.solanaKind(A.solUsdcMint), { kind: 'token', chain: 'solana' });
  eq(C.solanaKind(A.solWallet), { kind: 'wallet', chain: 'solana', chains: ['solana'] });
  eq(C.solanaKind(A.solTokenProgram).program, true);
  eq(C.solanaKind({ owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', executable: false, data: { parsed: { type: 'mint', info: { decimals: 0, supply: '1' } } } }).kind, 'nft');
  eq(C.solanaKind(null), null, 'no account');
});

test('chain: ABI strings, and bad ones', () => {
  eq(C.abiString('0x4d4b520000000000000000000000000000000000000000000000000000000000'), 'MKR', 'an old bytes32 answer');
  eq([C.abiString('0x'), C.abiString(null), C.abiString('0xzz')], ['', '', '']);
  eq(C.abiString('0x' + '0'.repeat(62) + '20' + 'f'.repeat(64)), '', 'a length past the answer');
});
