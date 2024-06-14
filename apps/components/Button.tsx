import { ComponentChildren, JSX } from 'preact';

type ButtonProps = {
  children: ComponentChildren;
} & JSX.HTMLAttributes<HTMLAnchorElement>;

export default function Button(props: ButtonProps) {
  return (
    <a class='rounded px-4 py-2 bg-blue-500' {...props}>
      {props.children}
    </a>
  );
}
