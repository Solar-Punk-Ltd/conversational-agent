import { Bee } from "@ethersphere/bee-js";
import type { Logger } from '@hashgraphonline/standards-sdk';
import { GenericPluginContext, HederaAgentKit } from "hedera-agent-kit";

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

jest.mock('hedera-agent-kit', () => ({
  BaseHederaQueryTool: class {
    logger = loggerMock;
    constructor(_params: any) {}
  },
}));

// jest.mock('@ethersphere/bee-js', () => ({
//   Bee: class {
//     getPostageBatch = jest.fn();
//   },
// }));

// jest.mock('../../utils', () => ({
//   errorHasStatus: jest.fn(),
//   getBatchSummary: jest.fn(),
//   getResponseWithStructuredContent: jest.fn((content) => content),
//   ToolResponse: {},
// }));

let beeMock: jest.Mocked<Bee> = new Bee("http://127.0.0.1:1633") as jest.Mocked<Bee>;
beeMock.getPostageBatch = jest.fn();
beeMock.getPostageBatches = jest.fn();
beeMock.buyStorage = jest.fn();
beeMock.extendStorage = jest.fn();


const swarmConfigMock = {
  beeApiUrl: 'http://127.0.0.1:1633',
  beeFeedPK: "",
  autoAssignStamp: true,
  deferredUploadSizeThresholdMB: 5 
};

const contextMock = {
  config: {
    hederaKit: {} as HederaAgentKit,
  },
  logger: loggerMock,
} as unknown as GenericPluginContext;

jest.mock('../../utils', () => {
  const originalModule = jest.requireActual('../../utils');

  return {
    ...originalModule,
    runWithTimeout: jest.fn(),
    getErrorMessage: jest.fn(),
  };
});


export {
  beeMock,
  contextMock,
  swarmConfigMock
};
