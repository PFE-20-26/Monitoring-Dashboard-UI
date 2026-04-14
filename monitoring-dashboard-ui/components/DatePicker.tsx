import React, { InputHTMLAttributes, useRef } from 'react';

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
    value: string;
    onChange: (value: string) => void;
    wrapperClassName?: string;
}

export default function DatePicker({ value, onChange, className, wrapperClassName, ...props }: DatePickerProps) {
    const hiddenRef = useRef<HTMLInputElement>(null);
    const displayValue = value ? value.split('-').reverse().join('/') : '';

    const openPicker = () => {
        const el = hiddenRef.current;
        if (!el) return;
        try {
            el.showPicker();
        } catch {
            // Fallback for browsers that don't support showPicker()
            el.focus();
            el.click();
        }
    };

    return (
        <div
            className={`relative ${wrapperClassName || ''}`}
            style={{ cursor: 'pointer' }}
            onClick={openPicker}
        >
            {/* Visible display that shows DD/MM/YYYY */}
            <input
                type="text"
                value={displayValue}
                readOnly
                placeholder="jj/mm/aaaa"
                className={className || ''}
                style={{ cursor: 'pointer', pointerEvents: 'none' }}
            />
            {/* Hidden native date input */}
            <input
                ref={hiddenRef}
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full cursor-pointer"
                style={{ opacity: 0.01 }}
                tabIndex={-1}
                {...props}
            />
        </div>
    );
}
