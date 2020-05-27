import {
  LiveSource,
  LiveCoordinator,
  LiveProvider,
  makeAsyncIteratorFromMonitor,
} from "../dist/Live";

// TODO: this file needs a *lot* more tests!

class DummyProvider extends LiveProvider {
  constructor() {
    super("dummy");
  }

  collectionIdentifierIsValid() {
    return true;
  }

  recordIdentifierIsValid() {
    return true;
  }
}

class DummySource extends LiveSource {
  collectionListeners: any[];
  recordListeners: any[];
  constructor() {
    super();
    this.collectionListeners = [];
    this.recordListeners = [];
  }

  subscribeCollection(callback, collectionIdentifier, predicate) {
    const entry = [callback, collectionIdentifier, predicate];
    this.collectionListeners.push(entry);
    return () => {
      const i = this.collectionListeners.indexOf(entry);
      if (i >= 0) {
        this.collectionListeners.splice(i, 1);
      }
    };
  }

  subscribeRecord(callback, collectionIdentifier, recordIdentifier) {
    const entry = [callback, collectionIdentifier, recordIdentifier];
    this.recordListeners.push(entry);
    return () => {
      const i = this.recordListeners.indexOf(entry);
      if (i >= 0) {
        this.recordListeners.splice(i, 1);
      }
    };
  }

  triggerRecord(collectionIdentifier, recordIdentifier) {
    for (const rl of this.recordListeners) {
      const [rlCallback, rlCollectionIdentifier, rlRecordIdentifier] = rl;
      if (
        collectionIdentifier === rlCollectionIdentifier &&
        recordIdentifier === rlRecordIdentifier
      ) {
        rlCallback({ collectionIdentifier, recordIdentifier });
      }
    }
  }
}

const dummySource = new DummySource();

test("works", async () => {
  const lc = new LiveCoordinator();
  const dummyProvider = new DummyProvider();
  lc.registerProvider(dummyProvider);
  lc.registerSource("dummy", dummySource);
  const monitor = lc.getMonitor({});
  const asyncIterator = makeAsyncIteratorFromMonitor(monitor);
  const collection = Symbol("collection");
  const record = Symbol("record");

  // Async iterator always immediately triggers
  {
    const { value, done } = await asyncIterator.next();
    expect(done).toBeFalsy();
    expect(value.counter).toMatchInlineSnapshot(`0`);
    expect(Object.keys(value)).toMatchInlineSnapshot(`
Array [
  "counter",
  "liveCollection",
  "liveRecord",
  "liveConditions",
  "release",
]
`);
  }

  // Now we register a listener
  monitor.liveRecord(0, "dummy", collection, record);
  // And trigger an update to it
  dummySource.triggerRecord(collection, record);
  // Which should mean we trigger again
  {
    const { value, done } = await asyncIterator.next();
    expect(done).toBeFalsy();
    expect(value.counter).toMatchInlineSnapshot(`1`);
    expect(Object.keys(value)).toMatchInlineSnapshot(`
Array [
  "counter",
  "liveCollection",
  "liveRecord",
  "liveConditions",
  "release",
]
`);
  }

  // Now we should have reset again (because we triggered), so if we trigger
  // another update it won't do anything
  dummySource.triggerRecord(collection, record);
  // So if we return
  asyncIterator.return();
  // Then done should be true immediately (no intermediate values generated by the above triggerRecord)
  {
    const { value, done } = await asyncIterator.next();
    expect(done).toBeTruthy();
    expect(value).toBe(undefined);
  }
});
