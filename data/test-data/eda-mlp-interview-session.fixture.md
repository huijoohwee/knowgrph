---
title: "EDA→MLP Interview Session Fixture"
mermaid: |
  graph TD

  subgraph L0["L0: BUSINESS OUTCOMES"]
    B_FE["B_FE: Feature engineering outcome"]
    B_CT["B_CT: Customer targeting outcome"]
    B_RC["B_RC: Risk control outcome"]
    B_OC["B_OC: Operational cost outcome"]
  end

  subgraph L1["L1: STAKEHOLDERS"]
    S_PM["S_PM: Product manager"]
    S_LC["S_LC: Legal counsel"]
    S_EM["S_EM: Experiment owner"]
  end

  subgraph L2["L2: KPIS"]
    K_REC["K_REC: Recall"]
    K_FPR["K_FPR: False positive rate"]
    K_PRE["K_PRE: Precision"]
    K_AUC["K_AUC: ROC AUC"]
    K_F1["K_F1: F1 score"]
  end

  subgraph L3["L3: DATA QUALITY"]
    ST_MNAR["ST_MNAR: Missing not at random"]
    ST_CHI["ST_CHI: Chi-square tests"]
    ST_VIF["ST_VIF: VIF analysis"]
    ST_SKEW["ST_SKEW: Skewness"]
    ST_QQ["ST_QQ: Q-Q plots"]
    ST_STRAT["ST_STRAT: Stratification checks"]
  end

  subgraph L4["L4: MODELS"]
    M_LOG["M_LOG: Logistic regression"]
    M_KNN["M_KNN: kNN classifier"]
    M_XGB["M_XGB: Gradient boosting"]
    M_THRE["M_THRE: Decision thresholding"]
  end

  subgraph L5["L5: IMPLEMENTATION"]
    I_PIPE["I_PIPE: Pipeline wiring"]
    I_ERR["I_ERR: Error handling"]
    I_MON["I_MON: Monitoring"]
    I_DEP["I_DEP: Deployment"]
  end

  subgraph L6["L6: MATHEMATICS"]
    MA_LOSS["MA_LOSS: Loss surface"]
    MA_GRAD["MA_GRAD: Gradients"]
    MA_SIG["MA_SIG: Significance tests"]
    MA_AUC["MA_AUC: AUC geometry"]
  end

  B_FE --> S_PM
  S_PM --> K_REC
  K_REC --> ST_MNAR
  ST_MNAR --> M_LOG
  M_LOG --> I_DEP
  I_DEP --> MA_AUC

  click B_FE "#eda-b-fe-anchor"
---

# EDA→MLP Interview Session Fixture

<a id="eda-b-fe-anchor"></a>

This fixture represents a neutral EDA→MLP interview-style document.

See [Business Feature Engineering](#eda-b-fe-anchor) for a simple internal link exercised by tests.

