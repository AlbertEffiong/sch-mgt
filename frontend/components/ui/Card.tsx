import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Card({ title, subtitle, action, footer, className = "", bodyClassName = "", style, children }: CardProps) {
  return (
    <section className={`card ${className}`} style={style}>
      {title || action ? (
        <div className="card-header">
          <div>
            <div className="card-title">{title}</div>
            {subtitle ? <div className="card-subtitle">{subtitle}</div> : null}
          </div>
          {action ? <div className="row">{action}</div> : null}
        </div>
      ) : null}
      <div className={`card-body ${bodyClassName}`}>{children}</div>
      {footer ? <div className="card-footer">{footer}</div> : null}
    </section>
  );
}
