import { jest } from '@jest/globals';

// Mock dependencies before importing FeeSponsor
jest.mock('../../config/index.js', () => ({
  config: {
    stellar: {
      rpcUrl: 'https://soroban-testnet.stellar.org',
      isMainnet: false,
    },
  },
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@stellar/stellar-sdk', () => {
  const mockTx = {
    sign: jest.fn(),
    toXDR: jest.fn<any>().mockReturnValue('mock-xdr'),
  };

  return {
    Keypair: {
      fromSecret: jest.fn<any>().mockReturnValue({
        publicKey: jest.fn<any>().mockReturnValue('GABCDEFG'),
        sign: jest.fn(),
      }),
    },
    TransactionBuilder: Object.assign(
      jest.fn<any>().mockImplementation(() => ({
        addOperation: jest.fn<any>().mockReturnThis(),
        setTimeout: jest.fn<any>().mockReturnThis(),
        build: jest.fn<any>().mockReturnValue(mockTx),
      })),
      {
        buildFeeBumpTransaction: jest.fn<any>().mockReturnValue(mockTx),
      }
    ),
    Networks: {
      PUBLIC: 'Public Global Stellar Network ; September 2015',
      TESTNET: 'Test SDF Network ; September 2015',
    },
    Operation: {
      invokeHostFunction: jest.fn<any>().mockReturnValue({}),
    },
    BASE_FEE: '100',
    rpc: {
      Server: jest.fn<any>().mockImplementation(() => ({
        getAccount: jest.fn<any>().mockResolvedValue({
          accountId: () => 'GABCDEFG',
          sequenceNumber: () => '12345',
          incrementSequenceNumber: jest.fn(),
        }),
        sendTransaction: jest.fn<any>().mockResolvedValue({
          status: 'PENDING',
          hash: 'abc123def456',
        }),
        getTransaction: jest.fn<any>().mockResolvedValue({
          status: 'SUCCESS',
        }),
      })),
    },
  };
});

// Set env before importing
process.env['KEEPER_PRIVATE_KEY'] = 'SCZANGBA5YHTNYVVV3C7CAZMCLP4ALI3IRZ3FIEC6EMUUAGIAJV4JJSR';

import { FeeSponsor } from '../FeeSponsor.js';

describe('FeeSponsor', () => {
  let sponsor: FeeSponsor;

  beforeEach(() => {
    jest.clearAllMocks();
    sponsor = new FeeSponsor();
  });

  it('should instantiate without errors', () => {
    expect(sponsor).toBeDefined();
  });

  it('should have a checkKeeperBalance method', async () => {
    const result = await sponsor.checkKeeperBalance();
    expect(result).toHaveProperty('balance');
    expect(result).toHaveProperty('isHealthy');
  });

  it('should throw when KEEPER_PRIVATE_KEY is not set', () => {
    const originalKey = process.env['KEEPER_PRIVATE_KEY'];
    process.env['KEEPER_PRIVATE_KEY'] = 'YOUR_SECRET_KEY';

    const noKeySponsor = new FeeSponsor();

    // sponsorPayment should throw because the key is the placeholder
    expect(
      noKeySponsor.sponsorPayment({
        subscriptionId: 'SUB_1',
        contractAddress: 'CABC123',
      })
    ).rejects.toThrow('KEEPER_PRIVATE_KEY is not set');

    process.env['KEEPER_PRIVATE_KEY'] = originalKey;
  });
});
