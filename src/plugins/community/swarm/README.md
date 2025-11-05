# Swarm Plugin

The Swarm Plugin provides tools for interacting with the Swarm decentralized storage.


## Features

- Upload text data to Swarm.
- Download text data from Swarm.
- Upload files and folders to Swarm.
- Download files and folders from Swarm.
- Update feed of data.
- Read feed of data.
- Create postage batches for storage.
- Get a postage batch.
- List postage batches.
- Extend storage and duration of a postage batch.


## Configuration Options

| Option                             | Type          | Default       | Description                                                         |
| -----------------------------------| --------------| --------------| ------------------------------------------------------------------- |
| `beeApiUrl`                        | string        | **required**  | The URL of the Bee node or of the Swarm Gateway.                    |
| `beeFeedPK`                        | string        | **required**  | The signer's private key used for updating the feed.                |
| `autoAssignStamp`                  | boolean       | undefined     | If true, the batch with highest capacity is used for uploads.       |
| `deferredUploadSizeThresholdMB`    | number        | undefined     | The threshold above which file upload is deferred. Default is 5 MB. |


## Quick Start

```typescript
import { ConversationalAgent, SwarmPlugin, SwarmConfig } from "@hashgraphonline/conversational-agent";

const swarmConfig: SwarmConfig = {
  beeApiUrl: process.env.SWARM_BEE_API_URL || "https://api.gateway.ethswarm.org",
  beeFeedPK: process.env.SWARM_BEE_FEED_PK!,
  autoAssignStamp: true,
  deferredUploadSizeThresholdMB: Number(process.env.DEFERRED_UPLOAD_SIZE_THRESHOLD_MB!),
};

// Initialize the agent
const agent = new ConversationalAgent({
  accountId: process.env.HEDERA_ACCOUNT_ID!,
  privateKey: process.env.HEDERA_PRIVATE_KEY!,
  network: 'testnet',
  openAIApiKey: process.env.OPENAI_API_KEY!,
  openAIModelName: 'gpt-4o',
  verbose: true,
  additionalPlugins: [new SwarmPlugin(swarmConfig)],
});

// Initialize (automatically detects key type)
await agent.initialize();

// Process a message
const response = await agent.processMessage(
  "Please list my stamps."
);

```


## Plugin Tools

The plugin provides the following tools:


### `swarm-create-postage-stamp`

Buy postage stamp based on size in megabytes and duration.

**Parameters:**

- `size`: The storage size in MB (Megabytes). These other size units convert like this to MB: 1 byte = 0.000001 MB, 1  KB = 0.001 MB, 1GB= 1000MB.
- `duration`: Duration for which the data should be stored. Time to live of the postage stamp, e.g. 1d - 1 day, 1w - 1 week, 1month - 1 month.
- `label`: (Optional) Sets label for the postage batch.

**Sample prompt:**

```bash
Please create new stamp with 4 days, 10 megabytes.
```

### `swarm-get-postage-stamp`

Get a specific postage stamp based on batch id.

**Parameters:**

- `postageBatchId`: The id of the stamp which is requested.

**Sample prompt:**

```bash
Please give me the details for batch 3b3881ac37f936a4023a4562c69f1f138df8c1c24994f7b047514fbcbe9388fa.
```


### `swarm-list-postage-stamps`

List the available postage stamps.

**Parameters:**

- `leastUsed`: (Optional) A boolean value that tells if stamps are sorted so least used comes first.
- `limit`: (Optional) Limit is the maximum number of returned stamps.
- `minUsage`: (Optional) Only list stamps with at least this usage percentage.
- `maxUsage`: (Optional) Only list stamps with at most this usage percentage.

**Sample prompt:**

```bash
Please list my stamps.
```


### `swarm-extend-postage-stamp`

Increase the duration (relative to current duration) or size (in megabytes) of a postage stamp.

**Parameters:**

- `postageBatchId`: The id of the batch for which extend is performed.
- `size`: (Optional) The storage size in MB (Megabytes). These other size units convert like this to MB: 1 byte = 0.000001 MB, 1  KB = 0.001 MB, 1GB= 1000MB.
- `duration`: (Optional) Duration for which the data should be stored. Time to live of the postage stamp, e.g. 1d - 1 day, 1w - 1 week, 1month - 1 month.

**Sample prompt:**

```bash
Please extend 3b3881ac37f936a4023a4562c69f1f138df8c1c24994f7b047514fbcbe9388fa to 5 days.
```


### `swarm-upload-data`

Upload text data to Swarm.

**Parameters:**

- `data`: Arbitrary string to upload.
- `redundancyLevel`: (Optional) Redundancy level for fault tolerance: 0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid (higher values provide better fault tolerance but increase storage overhead). Optional, value is 0 if not requested.
- `postageBatchId`: (Optional) The postage stamp batch ID which will be used to perform the upload, if it is provided.

**Sample prompt:**

```bash
Please upload data to Swarm: Hello World!.
```


### `swarm-download-data`

Downloads immutable data from a Swarm content address hash.

**Parameters:**

- `reference`: Swarm reference hash.

**Sample prompt:**

```bash
Please download from Swarm: 0cd17d822944c536c9955c15da5cb1b11b8dda339de4700d5821dd491ab07271.
```


### `swarm-update-feed`

Update the feed of a given topic with new data.

**Parameters:**

- `data`: Arbitrary string to upload.
- `memoryTopic`: If provided, uploads the data to a feed with this topic. It is the label of the memory that can be used later to retrieve the data instead of its content hash. If not a hex string, it will be hashed to create a feed topic.
- `postageBatchId`: (Optional) The postage stamp batch ID which will be used to perform the upload, if it is provided.

**Sample prompt:**

```bash
Please update the Swarm feed of Topic1 with: Message1 using postagebatch id 3b3881ac37f936a4023a4562c69f1f138df8c1c24994f7b047514fbcbe9388fa.
```


### `swarm-read-feed`

Retrieve the latest data from the feed of a given topic.

**Parameters:**

- `memoryTopic`: Feed topic.
- `owner`: (Optional) When accessing external memory or feed, ethereum address of the owner must be set..

**Sample prompt:**

```bash
Please read the Swarm feed of Topic1.
```


### `swarm-upload-file`

Upload a file to Swarm.

**Parameters:**

- `data`: base64 encoded file content or file path.
- `isPath`: Wether the data parameter is a path.
- `redundancyLevel`: (Optional) Redundancy level for fault tolerance (higher values provide better fault tolerance but increase storage overhead). 0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid.
- `postageBatchId`: (Optional) The postage stamp batch ID which will be used to perform the upload, if it is provided.

**Sample prompt:**

```bash
Please upload to Swarm the file: uploads/file.txt.
```


### `swarm-upload-folder`

Upload a folder to Swarm.

**Parameters:**

- `folderPath`: Path to the folder to upload. 
- `redundancyLevel`: (Optional) Redundancy level for fault tolerance (higher values provide better fault tolerance but increase storage overhead). 0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid. 
- `postageBatchId`: (Optional) The postage stamp batch ID which will be used to perform the upload, if it is provided.

**Sample prompt:**

```bash
Please upload to Swarm folder: uploads.
```


### `swarm-download-files`

Download folder, files from a Swarm reference and save to file path or return file list of the reference.


**Parameters:**

- `reference`: Swarm reference hash.
- `filePath`: (Optional) Optional file path to save the downloaded content. If not provided list of files in the manifest will be returned.

**Sample prompt:**

```bash
Please download from Swarm the file with reference 7547a32aebdc15d9c56c50016622fcef8ad33d6e0075de9966ec96de589fdc32 to folder downloads.
```


### `swarm-query-upload-progress`

Query upload progress for a specific upload session identified with the returned Tag ID.

**Parameters:**

- `tagId`: Tag ID returned by swarm-upload-file and swarm-upload-folder tools to track upload progress.

**Sample prompt:**

```bash
Please query Swarm for upload tag with id: 1.
```


## Run tests


```bash
npm run test src/plugins/community/swarm
```


## Resources

- [Official Swarm Documentation](https://docs.ethswarm.org/)
- [The Book Of Swarm](https://papers.ethswarm.org/p/book-of-swarm/)
