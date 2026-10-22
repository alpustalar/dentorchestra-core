'use client';

import * as React from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SelectInputProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'multiple' | 'size'
> & {
  size?: 'sm' | 'default';
};

type ParsedOption = {
  disabled?: boolean;
  label: React.ReactNode;
  value: string;
};

type ParsedGroup = {
  label?: React.ReactNode;
  options: ParsedOption[];
};

function optionValue(props: React.OptionHTMLAttributes<HTMLOptionElement>) {
  if (props.value !== undefined) return String(props.value);
  return typeof props.children === 'string' ||
    typeof props.children === 'number'
    ? String(props.children)
    : '';
}

function parseOptions(children: React.ReactNode): ParsedGroup[] {
  const groups: ParsedGroup[] = [];
  let looseOptions: ParsedOption[] = [];

  const flushLooseOptions = () => {
    if (!looseOptions.length) return;
    groups.push({ options: looseOptions });
    looseOptions = [];
  };

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    if (child.type === React.Fragment) {
      const nested = parseOptions(
        (child.props as { children?: React.ReactNode }).children
      );
      nested.forEach((group) => {
        if (group.label === undefined) looseOptions.push(...group.options);
        else {
          flushLooseOptions();
          groups.push(group);
        }
      });
      return;
    }

    if (child.type === 'optgroup') {
      flushLooseOptions();
      const props =
        child.props as React.OptgroupHTMLAttributes<HTMLOptGroupElement>;
      groups.push({
        label: props.label,
        options: parseOptions(props.children).flatMap((group) => group.options),
      });
      return;
    }

    if (child.type !== 'option') return;
    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    looseOptions.push({
      value: optionValue(props),
      label: props.children,
      disabled: props.disabled,
    });
  });

  flushLooseOptions();
  return groups;
}

const SelectInput = React.forwardRef<HTMLInputElement, SelectInputProps>(
  function SelectInput(
    {
      children,
      className,
      value,
      defaultValue,
      disabled,
      required,
      name,
      id,
      autoComplete,
      onChange,
      onBlur,
      size = 'default',
      ...triggerProps
    },
    ref
  ) {
    const groups = React.useMemo(() => parseOptions(children), [children]);
    const options = groups.flatMap((group) => group.options);
    const normalizedValue = value === '' ? null : value?.toString();
    const normalizedDefaultValue =
      defaultValue === '' ? null : defaultValue?.toString();
    const placeholder = options.find((option) => option.value === '')?.label;

    const handleValueChange = (nextValue: string | null) => {
      if (!onChange) return;
      const next = nextValue ?? '';
      onChange({
        target: { name: name ?? '', value: next },
        currentTarget: { name: name ?? '', value: next },
        type: 'change',
      } as unknown as React.ChangeEvent<HTMLSelectElement>);
    };

    return (
      <Select
        value={normalizedValue}
        defaultValue={normalizedDefaultValue}
        onValueChange={handleValueChange}
        inputRef={ref}
        name={name}
        id={id}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger
          {...(triggerProps as SelectPrimitive.Trigger.Props)}
          size={size}
          className={cn('w-full', className)}
          onBlur={
            onBlur as unknown as React.FocusEventHandler<HTMLButtonElement>
          }
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start">
          {groups.map((group, groupIndex) => (
            <SelectGroup key={groupIndex}>
              {group.label !== undefined && (
                <SelectLabel>{group.label}</SelectLabel>
              )}
              {group.options.map((option, optionIndex) => (
                <SelectItem
                  key={`${option.value}-${optionIndex}`}
                  value={option.value === '' ? null : option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    );
  }
);

export { SelectInput };
