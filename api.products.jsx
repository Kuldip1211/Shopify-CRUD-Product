// 📄 app/routes/api.products.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// 🧩 --- Fetch products with pagination (for Load More)
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after");

  const query = `
    query getProducts($after: String) {
      products(first: 5, after: $after) {
        edges {
          cursor
          node {
            id
            title
            handle
            status
            images(first: 1) {
              edges {
                node {
                  originalSrc
                  altText
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                  barcode
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, { variables: { after } });
    const data = await response.json();

    const products =
      data?.data?.products?.edges?.map((edge) => edge.node) || [];
    const pageInfo = data?.data?.products?.pageInfo || {};

    return json({ products, pageInfo });
  } catch (error) {
    console.error("❌ GraphQL Error:", error);
    return json({ products: [], pageInfo: {}, error: error.message });
  }
};

// 🧠 --- Handle create/update/delete actions
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const isDelete = url.searchParams.get("delete");

  // 🗑️ --- DELETE PRODUCT ---
  if (isDelete === "true") {
    const { id } = await request.json(); // ✅ match frontend body { id: deleteProduct.id }

    const mutationQuery = `
      mutation deleteProduct($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const response = await admin.graphql(mutationQuery, {
        variables: { input: { id } },
      });

      const data = await response.json();

      // ❗ Handle GraphQL user errors
      const errors = data?.data?.productDelete?.userErrors || [];
      if (errors.length > 0) {
        console.error("❌ Shopify userErrors:", errors);
        return json({ success: false, errors }, { status: 400 });
      }

      return json({
        success: true,
        deletedId: data?.data?.productDelete?.deletedProductId,
      });
    } catch (error) {
      console.error("❌ Error deleting product:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  // ✏️ --- UPDATE PRODUCT ---
  const body = await request.json();
  const { id, title, status, tags } = body;

  const mutationQuery = `
    mutation updateProduct($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
          status
          tags
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      id,
      title,
      status,
      tags,
    },
  };

  try {
    const response = await admin.graphql(mutationQuery, { variables });
    const data = await response.json();

    const errors = data?.data?.productUpdate?.userErrors || [];
    if (errors.length > 0) {
      console.error("⚠️ Shopify userErrors:", errors);
      return json({ success: false, errors }, { status: 400 });
    }

    return json({
      success: true,
      updatedProduct: data?.data?.productUpdate?.product,
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};
