"use client";

import Button from "./Button";

export default function IconButton({ icon, label, ...rest }) {
  return (
    <Button iconOnly leadingIcon={icon} aria-label={label} {...rest} />
  );
}
