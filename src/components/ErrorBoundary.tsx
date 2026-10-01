import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** mostra uma tela de erro legível em vez de página em branco */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro na interface:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Não foi possível abrir o app</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ocorreu um erro ao carregar a interface. Detalhe técnico (envie para o suporte):
          </p>
          <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">
            {String(error.message || error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
