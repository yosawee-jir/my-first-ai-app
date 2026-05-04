import { QRCodeCanvas } from 'qrcode.react';

export default function QRModal({ asset, onClose }) {
  const qrValue = [
    asset.asset_code && `Code: ${asset.asset_code}`,
    `Name: ${asset.name}`,
    asset.model         && `Model: ${asset.model}`,
    asset.serial_number && `S/N: ${asset.serial_number}`,
    asset.brand         && `Brand: ${asset.brand}`,
  ].filter(Boolean).join('\n');

  const downloadQR = () => {
    const canvas = document.getElementById(`qr-${asset.id}`);
    if (!canvas) return;
    const a    = document.createElement('a');
    a.href     = canvas.toDataURL('image/png');
    a.download = `qr-${asset.asset_code || asset.id}.png`;
    a.click();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box qr-modal">
        <div className="modal-header">
          <h3>Asset QR Code</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="qr-content">
          <QRCodeCanvas id={`qr-${asset.id}`} value={qrValue} size={220} level="M" includeMargin />
          <div className="qr-asset-info">
            <strong>{asset.name}</strong>
            {asset.asset_code    && <span><code>{asset.asset_code}</code></span>}
            {asset.serial_number && <span style={{ fontSize: '.82rem', color: '#888' }}>S/N: {asset.serial_number}</span>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={downloadQR}>⬇ Download PNG</button>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
