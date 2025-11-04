import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';

import { GetPostageStampTool } from '../../tools/GetPostageStampTool';
import { errorHasStatus, getBatchSummary, getResponseWithStructuredContent, ToolResponse } from '../../utils';
import { GATEWAY_STAMP_ERROR_MESSAGE } from '../../constants';
import type { HederaAgentKit } from 'hedera-agent-kit';
import { beeMock, contextMock, swarmConfigMock } from './SwarmTool.mocks';
import { PostageBatch } from '@ethersphere/bee-js';
import { PostageBatchCurated, PostageBatchSummary, ResponseContent } from '../../model';

describe('GetPostageStampTool', () => {
  let tool: GetPostageStampTool;
  let hederaKitMock: HederaAgentKit;
  

  beforeEach(() => {
    jest.clearAllMocks();

    hederaKitMock = {} as HederaAgentKit;

    tool = new GetPostageStampTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });
  });

  it('should throw an error if postageBatchId is missing', async () => {
    await expect(tool['executeQuery']({ postageBatchId: '' }))
      .rejects.toThrow('Missing required parameter: postageBatchId.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: postageBatchId.'
    );
  });

  it('should handle Bee getPostageBatch not found error', async () => {
    const error = new Error('Not found');
    (errorHasStatus as jest.Mock).mockReturnValue(true);
    beeMock.getPostageBatch.mockRejectedValue(error);

    await expect(tool['executeQuery']({ postageBatchId: '123' }))
      .rejects.toThrow(GATEWAY_STAMP_ERROR_MESSAGE);
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      GATEWAY_STAMP_ERROR_MESSAGE,
      error
    );
  });

  it('should handle Bee getPostageBatch other errors', async () => {
    const error = new Error('Server error');
    (errorHasStatus as jest.Mock).mockReturnValue(false);
    beeMock.getPostageBatch.mockRejectedValue(error);

    await expect(tool['executeQuery']({ postageBatchId: '123' }))
      .rejects.toThrow('Retrieval of postage batch failed.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Retrieval of postage batch failed.',
      error
    );
  });

  it('should return structured response on success', async () => {
    const rawBatch = { batchID: { toHex: () => 'abc123' }, someField: 42 } as unknown as PostageBatch;
    beeMock.getPostageBatch.mockResolvedValue(rawBatch);
    (getBatchSummary as jest.Mock).mockReturnValue({ summaryField: 1 });

    const result = await tool['executeQuery']({ postageBatchId: '123' }) as unknown as ResponseContent<PostageBatchCurated, PostageBatchSummary>;
    expect(result.raw.batchID).toBe('abc123');
    expect(result.summary).toEqual({ summaryField: 1 });
    expect(getBatchSummary).toHaveBeenCalledWith(rawBatch);
    expect(getResponseWithStructuredContent).toHaveBeenCalled();
  });
});