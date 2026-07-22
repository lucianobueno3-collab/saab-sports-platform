# Changelog

Todas as mudanças relevantes desta aplicação são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/):
`MAIOR.MENOR.CORRECAO` (ex.: `1.2.3`).

> A **data/hora do último deploy** aparece no rodapé do app (sidebar, menu do
> celular, portal do atleta e login). O **número da versão** sobe sozinho a cada
> merge na `main` (patch por padrão; `[bump-minor]` / `[bump-major]` no título
> do PR para subir minor/maior).

## [Não lançado]

_Nada por enquanto._

## [1.0.1] — 2026-07-22

### Corrigido
- Bump automático de versão passa a considerar apenas o assunto do commit
  (a primeira linha), evitando subir a versão por engano quando o corpo do PR
  menciona os marcadores de minor/maior.

## [1.0.0] — 2026-07-22

Primeira versão versionada da plataforma. Resumo do que já estava no ar:

### Adicionado
- **Versionamento da aplicação** com número de versão e carimbo de data/hora
  do último deploy visível no app.
- **Acesso e papéis**: tela de login com seletor Sou treinador / Sou atleta,
  selo de papel (Admin/Treinador/Atleta) dentro do app.
- **Conta dupla**: um treinador pode também ser atleta, com o mesmo login e
  alternância entre as áreas (Ver como atleta / Ver como treinador).
- **Gestão de contas**: criar treinadores, admins e atletas com senha
  temporária; excluir aluno e excluir treinador; tornar um treinador também
  atleta pelo painel de administração.
- **Portal do atleta** como ficha completa em abas (Calendário, Hoje, Saúde,
  Nutrição, Provas, Evolução, Meus dados), com o atleta anexando documentos,
  registrando composição corporal, provas, metas e editando dados físicos.
- **Calendário de treinos** (semana/mês) no estilo TrainingPeaks/Garmin, com
  mês como visão padrão, arrastar treino da biblioteca para o dia e a visão do
  atleta em modo somente leitura.
- **Check-in ao concluir o treino** (dificuldade + relato de dores/feedback).
- **Importação do TrainingPeaks** com métricas completas (potência, FC,
  cadência, velocidade, torque, energia, zonas de FC/potência, RPE, sensação,
  comentários e planejado) para análise e futuros dashboards.
- **Leitura de PDF** (exames/bioimpedância) no servidor, robusta em qualquer
  navegador, inclusive para o atleta ler os próprios documentos.

### Corrigido
- Leitura de PDF que falhava em navegadores/Safari antigos (movida para o
  servidor).
- Enquadramento dos modais (renderizados via portal, centralizados na janela).

[Não lançado]: https://github.com/lucianobueno3-collab/saab-sports-platform/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/lucianobueno3-collab/saab-sports-platform/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/lucianobueno3-collab/saab-sports-platform/releases/tag/v1.0.0
