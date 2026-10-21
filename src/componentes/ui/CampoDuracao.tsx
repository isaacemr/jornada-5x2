import { useEffect, useState } from 'react';
import { formatarDuracao, lerDuracao } from '../../dominio/tempo';
import { CampoTexto } from './Campos';

/** Campo de duração (aceita 44, 44h, 8h48, 8:48). Atualiza o valor em minutos ao digitar um formato válido. */
export function CampoDuracao({
  rotulo,
  valorMin,
  onChange,
  dica,
  className,
}: {
  rotulo: string;
  valorMin: number | undefined;
  onChange: (min: number | undefined) => void;
  dica?: string;
  className?: string;
}) {
  const [texto, setTexto] = useState(valorMin !== undefined ? formatarDuracao(valorMin) : '');
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const atual = lerDuracao(texto);
    if (valorMin !== undefined && atual !== valorMin) setTexto(formatarDuracao(valorMin));
    if (valorMin === undefined && texto && atual !== null) setTexto('');
    // Só reage a mudanças externas do valor (o texto digitado não dispara este efeito).
  }, [valorMin]);
  return (
    <CampoTexto
      className={className}
      rotulo={rotulo}
      value={texto}
      dica={dica ?? 'Ex.: 44h, 8h48'}
      erro={erro}
      onChange={(e) => {
        setTexto(e.target.value);
        if (!e.target.value.trim()) {
          setErro(null);
          onChange(undefined);
          return;
        }
        const m = lerDuracao(e.target.value);
        setErro(m === null ? 'Formato não reconhecido' : null);
        if (m !== null) onChange(m);
      }}
    />
  );
}
