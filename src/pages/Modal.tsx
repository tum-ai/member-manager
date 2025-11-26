import React from 'react'

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  onConfirm: () => void;
  confirmDisabled?: boolean;
}

export default function Modal({ title, onClose, children, onConfirm, confirmDisabled }: ModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          color: 'black',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          borderRadius: '8px',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }}
          aria-label="Close"
        >
          ×
        </button>

        <h2 style={{ marginTop: 0 }}>{title}</h2>

        <div>{children}</div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{
              backgroundColor: confirmDisabled ? '#aaa' : '#3c00b4',
              color: 'white',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              cursor: confirmDisabled ? 'not-allowed' : 'pointer'
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
