/// <reference path="../pb_data/types.d.ts" />

// Creates the `app_state` collection used by web-preview/store.js for shared
// server sync (single record with key="main", JSON payload). Public rules match
// the production backend, which the unauthenticated PWA reads and writes.
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "app_state",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "key", type: "text", required: true, max: 100 },
      { name: "payload", type: "json", maxSize: 20000000 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_app_state_key ON app_state (key)",
    ],
  });
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("app_state");
  app.delete(collection);
});
