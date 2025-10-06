// 📄 app/routes/app.products.jsx
import React, { useState, useCallback } from "react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  Card,
  Page,
  Layout,
  Button,
  Spinner,
  Frame,
  Modal,
  TextField,
  Select,
  Toast,
} from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";

// 🧩 --- Loader: Fetch initial 5 products ---
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const query = `
    query {
      products(first: 5) {
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
    const response = await admin.graphql(query);
    const data = await response.json();

    const products =
      data?.data?.products?.edges?.map((edge) => edge.node) || [];
    const pageInfo = data?.data?.products?.pageInfo || {};

    return json({ products, pageInfo });
  } catch (error) {
    console.error("❌ GraphQL Error:", error);
    return json({ products: [], pageInfo: {} });
  }
};

// 🧠 --- Component ---
export default function ProductsPage() {
  const { products: initialProducts, pageInfo } = useLoaderData();
  const [products, setProducts] = useState(initialProducts);
  const [nextCursor, setNextCursor] = useState(pageInfo.endCursor);
  const [hasNextPage, setHasNextPage] = useState(pageInfo.hasNextPage);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);

  // 🆕 Delete modal state
  const [deleteProduct, setDeleteProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    id: "",
    title: "",
    status: "",
    price: "",
  });

  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [deleteToast, setDeleteToast] = useState("");
  const toggleToast = useCallback(() => setToastActive((prev) => !prev), []);
  const toggleDeleteToast = useCallback(() => setDeleteToast(""), []);

  // 🧠 When modal opens (update modal)
  const toggleModal = useCallback(
    (product = null) => {
      if (product) {
        setFormData({
          id: product.id,
          title: product.title || "",
          status: product.status || "DRAFT",
          price: product.variants?.edges?.[0]?.node?.price || "",
        });
      }
      setActiveProduct(product);
    },
    [setActiveProduct]
  );

  // ✏️ Handle form change
  const handleChange = (field) => (value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // 🔄 Load More
  const handleLoadMore = async () => {
    if (!hasNextPage) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/products?after=${nextCursor}`);
      const data = await response.json();

      const newProducts = data?.products || [];
      if (newProducts.length > 0) {
        setProducts((prev) => [...prev, ...newProducts]);
        setNextCursor(data.pageInfo.endCursor);
        setHasNextPage(data.pageInfo.hasNextPage);
      }
    } catch (err) {
      console.error("⚠️ Error loading more products:", err);
    }
    setLoading(false);
  };

  // 💾 Save Product Updates
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        const updated = await fetch("/api/products?refresh=true");
        const updatedData = await updated.json();

        if (updatedData?.products) setProducts(updatedData.products);
        setToastActive(true);
      } else {
        console.error("⚠️ Update failed:", result.error);
      }

      toggleModal(null);
    } catch (error) {
      console.error("❌ Error saving product:", error);
    } finally {
      setSaving(false);
    }
  };

  // 🗑️ Delete Product
  const handleDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/products?delete=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteProduct.id }),
      });

      const result = await response.json();

      if (result.success) {
        // Remove product from UI
        setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id));

        // ✅ Show toast with product title
        setDeleteToast(deleteProduct.title);
      } else {
        console.error("⚠️ Delete failed:", result.error);
      }
    } catch (error) {
      console.error("❌ Error deleting product:", error);
    } finally {
      setDeleting(false);
      setDeleteProduct(null);
    }
  };

  return (
    <Page title="Shopify Products">
      <Layout>
        <Layout.Section>
          {products.length === 0 ? (
            <p>No products found.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "20px",
                marginTop: "25px",
              }}
            >
              {products.map((p) => {
                const image =
                  p.images?.edges?.[0]?.node?.originalSrc ||
                  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";

                return (
                  <Card
                    key={p.id}
                    sectioned
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      borderRadius: "14px",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                      backgroundColor: "#fff",
                    }}
                  >
                    <div
                      style={{
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "200px",
                          overflow: "hidden",
                          borderRadius: "10px",
                          marginBottom: "10px",
                          backgroundColor: "#f6f6f7",
                        }}
                      >
                        <img
                          src={image}
                          alt={p.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "10px",
                          }}
                        />
                      </div>

                      <h2 style={{ fontSize: "1rem", fontWeight: "600" }}>
                        {p.title}
                      </h2>
                      <p style={{ color: "#616161" }}>
                        Status:{" "}
                        <span
                          style={{
                            color:
                              p.status === "ACTIVE" ? "#108043" : "#8C9196",
                          }}
                        >
                          {p.status}
                        </span>
                      </p>
                      <p style={{ fontWeight: "500", color: "#212B36" }}>
                        Price: ₹{p.variants?.edges?.[0]?.node?.price || "N/A"}
                      </p>
                    </div>

                    {/* Buttons Section */}
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: "10px",
                        display: "flex",
                        justifyContent: "center",
                        gap: "10px",
                      }}
                    >
                      <Button primary onClick={() => toggleModal(p)}>
                        Update
                      </Button>

                      <Button
                        tone="critical"
                        variant="primary"
                        style={{ backgroundColor: "#D72C0D", color: "#fff" }}
                        onClick={() => setDeleteProduct(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Load More Button */}
          <div style={{ textAlign: "center", marginTop: "30px" }}>
            {loading ? (
              <Spinner accessibilityLabel="Loading more products" size="large" />
            ) : hasNextPage ? (
              <Button primary onClick={handleLoadMore}>
                Load More Products
              </Button>
            ) : (
              <p style={{ color: "#8C9196" }}>All products loaded ✅</p>
            )}
          </div>
        </Layout.Section>
      </Layout>

      <Frame>
        {/* 🧠 Update Modal */}
        {activeProduct && (
          <Modal
            open={!!activeProduct}
            onClose={() => toggleModal(null)}
            title={`Update: ${activeProduct.title}`}
            primaryAction={{
              content: saving ? "Saving..." : "Save Changes",
              onAction: handleSave,
              disabled: saving,
            }}
            secondaryActions={[
              { content: "Cancel", onAction: () => toggleModal(null) },
            ]}
          >
            <Modal.Section>
              {saving ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "40px",
                  }}
                >
                  <Spinner size="large" accessibilityLabel="Saving..." />
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "15px",
                  }}
                >
                  <TextField label="Product ID" value={formData.id} disabled />
                  <TextField
                    label="Product Title"
                    value={formData.title}
                    onChange={handleChange("title")}
                  />
                  <Select
                    label="Status"
                    options={[
                      { label: "Active", value: "ACTIVE" },
                      { label: "Draft", value: "DRAFT" },
                      { label: "Archived", value: "ARCHIVED" },
                    ]}
                    value={formData.status}
                    onChange={handleChange("status")}
                  />
                  <TextField
                    label="Price (₹)"
                    type="number"
                    value={formData.price}
                    onChange={handleChange("price")}
                  />
                </div>
              )}
            </Modal.Section>
          </Modal>
        )}

        {/* 🗑️ Delete Modal */}
        {deleteProduct && (
          <Modal
            open={!!deleteProduct}
            onClose={() => setDeleteProduct(null)}
            title="Delete Product"
            primaryAction={{
              content: deleting ? "Deleting..." : "Delete Product",
              destructive: true,
              onAction: handleDelete,
              disabled: deleting,
            }}
            secondaryActions={[
              { content: "Cancel", onAction: () => setDeleteProduct(null) },
            ]}
          >
            <Modal.Section>
              <TextField label="Product ID" value={deleteProduct.id} disabled />
              <p style={{ marginTop: "10px" }}>
                Are you sure you want to delete{" "}
                <strong>{deleteProduct.title}</strong>?
              </p>
            </Modal.Section>
          </Modal>
        )}

        {/* ✅ Toasts */}
        {toastActive && (
          <Toast
            content="✅ Product updated successfully!"
            onDismiss={toggleToast}
          />
        )}

        {deleteToast && (
          <Toast
            content={`🗑️ Product "${deleteToast}" was deleted successfully!`}
            tone="critical"
            onDismiss={toggleDeleteToast}
          />
        )}
      </Frame>
    </Page>
  );
}
