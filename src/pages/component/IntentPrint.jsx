import React, { useRef } from "react";
import html2pdf from 'html2pdf.js';

const PdfPrint = ({ intentData}) => {
  return (
    <>  
    <div className="print-page">
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

          <h2>{intentData.intentNumber}</h2>

          <span className="status-badge">
            REQUESTED
          </span>
        </div>

      </div>


      {/* ================= ITEM TABLE ================= */}
      <div className="table-wrapper">
        <table className="intentData-table">
          <thead>
            <tr>
              <th className="center">#</th>
              <th>SKU</th>
              <th>ITEM CODE</th>
              <th>VENDOR</th>
               <th>VENDOR CODE</th>
              <th className="center">UNIT COST</th>
              <th className="center">QTY</th>
              <th className="center">TOTAL</th>
              {/*<th className="center">ORDER</th>*/}
            </tr>
          </thead>

          <tbody>
            {intentData.items.map((item, index) => {
              const cost = Number(item.cost) || 0;
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
                    {item.vendorName || "N/A"}
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
                colSpan="5"
                className="grand-label"
              >
                GRAND TOTAL
              </td>

              <td className="center">
                ₹
                {intentData.items
                  .reduce(
                    (sum, item) =>
                      sum + (Number(item.cost) || 0),
                    0
                  )
                  .toFixed(2)}
              </td>

              <td className="center">
                {intentData.totalQuantity}
              </td>
           

              <td className="center grand-cost">
                ₹
                {Number(
                  intentData.totalCost
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
          Purchase Intent • {intentData.intentNumber}
        </span>

        <span>
          Generated on{" "}
          {new Date(
            intentData.generatedAt
          ).toLocaleString("en-IN")}
        </span>

      </div>

    </div>
    </>
  );
};

export default PdfPrint;