import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";

console.log("hi from worker", workerData);

export default "yo";

process.once("message", (m) => {
  console.log("CHILD got message:", m);
});

process.send?.({ yo: 123 });
