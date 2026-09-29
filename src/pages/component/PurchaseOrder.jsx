import React, { useRef } from "react";
import html2pdf from 'html2pdf.js';

const PdfPrint = ({ purchaseOrder }) => {
  console.log(purchaseOrder);
  return (
    <>
      <div className="print-page" id="main-content">
        {/* ================= HEADER ================= */}
        <div className="pi-header">

          <div className="company-section">
            <div className="company-logo">
              K
            </div>

            <div className="company-label">
              <h1>KINYA MEDICAL SYSTEMS AND SOLUTION</h1>
              <p>Purchae Order</p>
            </div>
          </div>

          <div className="document-section">
            <span className="document-label">
              PURCHASE INTENT
            </span>

            <h2>{purchaseOrder.po_number}</h2>
            <span className="status-badge">
              {purchaseOrder.status}
            </span>
          </div>

        </div>
        <div className="poDetails-header">
          <div className="po-section PoDetails">
            <p>PO Number : <span>{purchaseOrder.po_number}</span></p>
            <p>PO Date : <span>{purchaseOrder.po_date}</span></p>
            <p>Intent Number : <span>{purchaseOrder.intent_number}</span></p>
          </div>
          
          <div className="po-section VendorDetails">
            <h2>Purchase order</h2>
            <p>{purchaseOrder.vendor_name}</p>
            <p>{purchaseOrder.address}</p>
          </div>
        </div>

        {/* ================= ITEM TABLE ================= */}
        <div className="table-wrapper">
          <table className="PoData-table">
            <thead>
              <tr>
                <th className="center">#</th>
                <th>SKU</th>
                <th>ITEM CODE</th>
                <th>VENDOR CODE</th>
                <th className="center">UNIT COST</th>
                <th className="center">QTY</th>
                <th className="center">TOTAL</th>
                {/*<th className="center">ORDER</th>*/}
              </tr>
            </thead>

            <tbody>
              {purchaseOrder.items.map((item, index) => {
                const cost = Number(item.unitCost) || 0;
                const quantity = Number(item.quantity) || 0;
                const total = cost * quantity;

                return (
                  <tr key={index}>

                    <td className="center item-number">
                      {index + 1}
                    </td>

                    <td>
                      <strong>
                        {item.sku || "N/A"}
                      </strong>
                    </td>

                    <td>
                      {item.itemCode ||
                        item.item_code ||
                        "N/A"}
                    </td>

                    <td>
                      {item.vendorCode ||
                        item.vendor_code ||
                        "N/A"}
                    </td>

                    <td className="center">
                      ₹{cost.toFixed(2)}
                    </td>

                    <td className="center quantity">
                      {quantity}
                    </td>

                    <td className="center total-cost">
                      ₹{total.toFixed(2)}
                    </td>

                    {/* <td className="center">

                    {item.orderLink ||
                    item.order_link ? (

                      <a
                        href={
                          item.orderLink ||
                          item.order_link
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="order-link"
                      >
                        View
                      </a>

                    ) : (
                      <span className="no-link">
                        N/A
                      </span>
                    )}

                  </td>*/}

                  </tr>
                );
              })}

            </tbody>

            {/* ================= TOTAL ================= */}
            <tfoot>

              <tr className="grand-total">
                <td
                  colSpan="3"
                  className="grand-label"
                >
                  GRAND TOTAL
                </td>

                 <td className="center">
                  tax({purchaseOrder.tax_rate}%)
                </td>

                <td className="center">
                  ₹
                  {purchaseOrder.items
                    .reduce(
                      (sum, item) =>
                        sum + (Number(item.totalCost) || 0),
                      0
                    )
                    .toFixed(2)}
                </td>

                <td className="center">
                  {purchaseOrder.items.reduce((sum,item)=>sum+(Number(item.quantity)||0),0)}
                </td>

                

                <td className="center grand-cost">
                  ₹
                  {Number(
                    purchaseOrder.total_amount
                  ).toFixed(2)}
                </td>
              </tr>

            </tfoot>

          </table>

        </div>


        {/* ================= NOTES ================= */}
        <div className="notes-section">

          <div>
            <h3>Purchase Notes</h3>

            <p>
              This purchase intent has been generated
              by the Purchase Department for procurement
              processing and vendor ordering.
            </p>
          </div>

        </div>


        {/* ================= APPROVAL ================= */}
        <div className="approval-section">
          <div className="signature-box">
            <div className="signature-Pd"><strong> Prepared By</strong> <span>(Purchase Department)</span></div>
            <div className="signature-line"></div>
          </div>

          <div className="signature-box">
            <strong>
              Approved By
            </strong>
            <div className="signature-line"></div>
          </div>
        </div>


        {/* ================= FOOTER ================= */}
        <div className="print-footer">
         
          <span>
            KINYA MEDICAL SYSTEM
          </span>

          <span>
            Purchase Intent • {purchaseOrder.intentNumber}
          </span>

          <span>
            Generated on{" "}
            {new Date(
              purchaseOrder.generatedAt
            ).toLocaleString("en-IN")}
          </span>
        
        </div>

      </div>
    </>
  );
};

export default PdfPrint;