const numberFormat = new Intl.NumberFormat('sr-Latn-RS', { maximumFractionDigits: 2 });

export function PriceDisplay({ label, value }: { label: string; value: number | string }) {
 return <dl className="field price-display">
  <dt>{label}</dt>
  <dd>{typeof value === 'number' ? numberFormat.format(value) : value}</dd>
 </dl>;
}
