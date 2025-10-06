# Shopify-CRUD-Product
# Shopify Products Admin (Remix + Polaris)

> A lightweight admin UI built with **Remix**, **Shopify Admin GraphQL**, and **Shopify Polaris**. This repo shows how to **fetch, create, update, and delete (CRUD)** Shopify products using GraphQL and how the front-end (Polaris modals, cards, toast) connects with Remix server actions/loaders.

---

# 🚀 Features

* Fetch paginated products (cursor-based) using the `loader` and a GraphQL query.
* Update products (via `productUpdate` GraphQL mutation).
* Delete products (via `productDelete` GraphQL mutation) — triggered from a modal and handled by a Remix `action`.
* Clean UI using **Shopify Polaris** components (Cards, Modals, Toasts, Spinner).
* Simple `Load More` pagination with `endCursor` and `hasNextPage`.

---

# 📁 File Overview

* `app/routes/app.products.jsx` — React component & UI. Uses `useLoaderData()` to get initial products, shows product cards and modals for update/delete.
* `app/routes/api.products.jsx` — Remix loader/action route used by the UI for:

  * `GET` (loader): fetch paginated product lists from Shopify.
  * `POST` (action): update or delete a product depending on `?delete=true` query.
* `shopify.server` — server-side helper that authenticates with Shopify and exposes `admin` GraphQL client (server-only).

---

# 🔧 Setup (Quick)

1. Clone the repo

```bash
git clone <your-repo-url>
cd <your-repo>
```

2. Install dependencies

```bash
npm install
# or
yarn
```

3. Environment variables (example)

Create a `.env` with your shop credentials (server-side only — NEVER commit secrets):

```
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_ADMIN_TOKEN=...
SHOP=my-store.myshopify.com
SESSION_SECRET=...
```

> The app expects server-side authentication helper (`authenticate.admin`) which returns an `admin` object with a `graphql(query, opts)` method.

4. Run dev server

```bash
npm run dev
# or
yarn dev
```

Open your app (Remix dev URL) and the products page (e.g. `/app.products`).

---

# 📖 How pagination works (cursor-based)

Shopify GraphQL uses cursor-based pagination:

* Request N items with `first: N`.
* Response includes `edges` (each has `cursor` and `node`) and `pageInfo { endCursor, hasNextPage }`.
* To fetch the next page, pass `after: <endCursor>` in the query variables.

**Example query** (first 5 products):

```graphql
query getProducts($after: String) {
  products(first: 5, after: $after) {
    edges {
      cursor
      node {
        id
        title
        handle
        status
        images(first: 1) { edges { node { originalSrc altText } } }
        variants(first: 1) { edges { node { id price barcode } } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

On the server, you can read `after` from the request (`/api/products?after=<cursor>`) and pass it as variables to the GraphQL call.

---

# ✍️ CRUD with GraphQL (examples & explanation)

> All GraphQL operations are executed server-side (via the `admin` client). The front-end calls Remix routes (`loader` and `action`) which in turn call Shopify.

## 1) Read — fetch products (already shown above)

* Send `after` variable when requesting the next page.
* Map the returned `edges` to `node` to get product objects in the UI.

Example server call:

```js
const response = await admin.graphql(query, { variables: { after } });
const data = await response.json();
const products = data.data.products.edges.map(e => e.node);
```

## 2) Create — `productCreate`

```graphql
mutation createProduct($input: ProductInput!) {
  productCreate(input: $input) {
    product { id title }
    userErrors { field message }
  }
}
```

Variables example:

```json
{
  "input": {
    "title": "New product",
    "variants": [ { "price": "99.99" } ]
  }
}
```

**Note:** create typically isn't part of the sample UI provided; if you add a "New Product" flow, call this mutation server-side and return the new product.

## 3) Update — `productUpdate`

```graphql
mutation updateProduct($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title status tags }
    userErrors { field message }
  }
}
```

Variables example (server action receives a body with fields):

```js
const variables = {
  input: { id, title, status, tags }
};
await admin.graphql(mutationQuery, { variables });
```

Important: check `data.data.productUpdate.userErrors`. If any errors exist, return them to the client and do not assume success.

## 4) Delete — `productDelete` (your implemented flow)

```graphql
mutation deleteProduct($input: ProductDeleteInput!) {
  productDelete(input: $input) {
    deletedProductId
    userErrors { field message }
  }
}
```

Server-side example (match the frontend body):

```js
// The front-end calls: POST '/api/products?delete=true' with body { id }
const { id } = await request.json();
const response = await admin.graphql(deleteMutation, { variables: { input: { id } } });
const data = await response.json();
// check data.data.productDelete.userErrors
```

If successful: server should return `{ success: true, deletedId }`.

---

# 🔁 Frontend ↔ Backend (Remix) flow

* **Loader** (`app.routes.app.products.jsx`): runs server-side and returns initial products & pageInfo.
* **Client** `useLoaderData()` initializes `products` state.
* **Load More** button calls `/api/products?after=<cursor>` which returns next page JSON; client appends new products.
* **Update** modal posts to `/api/products` (action) with `{ id, title, status, tags }`; server runs `productUpdate` and returns success status.
* **Delete** modal posts to `/api/products?delete=true` with `{ id }`; server runs `productDelete` and returns success status; client removes deleted product from state and shows a toast.

---

# ✅ Example frontend delete call

```js
// when user clicks confirm delete in modal
await fetch('/api/products?delete=true', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: deleteProduct.id })
});
```

Expected server response on success:

```json
{ "success": true, "deletedId": "gid://shopify/Product/123456789" }
```

On the client, use that to update UI:

```js
setProducts(prev => prev.filter(p => p.id !== deletedId));
setDeleteToast(deletedProductTitle);
```

---

# 🐞 Common issues & fixes

* **Product ID is empty in modal**: Ensure you set the `deleteProduct` state to the product object; in modal use `deleteProduct.id` (not `formData.id`).
* **Mismatched request body key**: Frontend sends `{ id }` but backend expects `{ productId }` — they must match. Use `{ id }` in both sides for simplicity.
* **GraphQL `userErrors` present**: Always check `data.data.<mutation>.userErrors` and surface them to the user.
* **401 / authentication errors**: Confirm `authenticate.admin(request)` correctly returns an `admin` client with valid session/token.
* **Rate limiting / timeouts**: Shopify Admin has rate limits. Retry with exponential backoff for transient failures.

---

# 🔐 Security notes

* Never expose Shopify admin tokens on the client. All GraphQL calls to Shopify must be made server-side.
* Protect the Remix action endpoints (e.g., only authenticated admins should be able to call delete/update).
* Sanitize and validate input on the server-side before calling Shopify.

---

# 🧪 Testing & Debugging tips

* Use Shopify Admin's GraphiQL (or Postman) to validate GraphQL queries/mutations and variables.
* Log `data` returned from `admin.graphql(...)` to see the exact `userErrors` and payload.
* If delete fails, verify the exact `id` (must be Shopify global id: `gid://shopify/Product/<id>`).
* Add `console.error()` for server-side catches so you can inspect server logs.

---

# 💡 Next improvements / ideas

* Add **create product** UI.
* Implement optimistic UI updates (show immediate removal with undo toast).
* Add bulk actions (bulk delete) and search/filtering.
* Add tests for the loader/action using Remix testing utilities.

---

# ❤️ Thanks

If you want, I can:

* Add the product **create** modal and server handler.
* Add unit/integration tests for the API route.
* Improve UX with an `Undo` for deletes.

Happy coding — let me know any changes you want! ✨
