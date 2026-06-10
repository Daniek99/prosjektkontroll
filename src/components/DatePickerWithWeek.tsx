
import DatePicker, { registerLocale } from 'react-datepicker';
import { nb } from 'date-fns/locale/nb';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('nb', nb);

interface DatePickerWithWeekProps {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    className?: string;
    placeholderText?: string;
    required?: boolean;
    disabled?: boolean;
}

export default function DatePickerWithWeek({
    selected,
    onChange,
    className,
    placeholderText,
    required,
    disabled
}: DatePickerWithWeekProps) {
    return (
        <DatePicker
            selected={selected}
            onChange={onChange}
            locale="nb"
            dateFormat="dd.MM.yyyy"
            showWeekNumbers
            className={className}
            placeholderText={placeholderText}
            required={required}
            disabled={disabled}
            popperPlacement="bottom-start"
            isClearable={!required}
        />
    );
}
