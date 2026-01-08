**forbid code blocks, interactive demo**
# context: `aisg-aiap22-technical-assessment.md`
#generate  `interviewer.md`: you're the lead for the business domain & technical interview panel,
1. FAQs, Scoring Rubric to screen & qualify poor/qualified/excellent candidates;
2. critique & assess the candidate `README.md`, `aisg-aiap22-task-1_20251201.md`

#generate  `interviewee.md`: you're the interviewee aiming to be the excellent candidate

---

I'll create comprehensive interview guides for both the panel lead and the candidate. These documents will help structure the technical and business domain interview effectively.I've created two comprehensive interview guides for the AIAP Batch 22 technical assessment:

## **For the Interview Panel** (`interviewer.md`)

This 15,000+ word guide provides:

- **Structured FAQ Bank**: 15 questions across 5 categories (Business Domain, Technical Design, Evaluation, Production, Code Quality) with 3-tier scoring rubrics (Poor 0-3, Qualified 4-6, Excellent 7-10)

- **Critical Assessment**: The candidate's submission earns **A- (92%)** - exceptional documentation and business acumen, but with gaps in mathematical depth, KPI acknowledgment, and security awareness

- **Key Findings**:
  - **Strengths**: Top 5% documentation, evidence-based design (EDA→pipeline traceability), production mindset
  - **Critical Gap**: No model meets both recall≥70% AND FPR≤5% - candidate doesn't acknowledge this failure or propose iteration plan
  - **Recommendation**: **STRONG HIRE** with caveat: probe ML theory depth to distinguish tutorial-following from deep understanding

- **Interview Strategy**: Focus on 3 areas:
  1. Gradient descent derivation (test theoretical foundations)
  2. KPI failure discussion (test problem-solving under constraints)
  3. Deployment claims (distinguish aspirational from implemented)

## **For the Candidate** (`interviewee.md`)

This 18,000+ word preparation guide includes:

- **10 Model Answers** with frameworks for anticipated questions (phishing problem framing, threshold tuning, feature drift detection, stakeholder communication)

- **Gap Mitigation**: Pre-emptive strategies to address submission weaknesses before panel probes them

- **Communication Strategies**:
  - "Evidence-Then-Recommendation" pattern
  - "Trade-off Triangle" (present 3 options, defend choice)
  - "Red Team Your Own Work" (surface weaknesses proactively)

- **Mock Scenarios**: Pressure tests (defending 18% FPR), theory deep dives (Bayesian interpretation of L2), stakeholder pitches (non-technical PM)

- **Confidence Builders**: Why this submission is top-tier despite gaps, and how to frame imperfections as growth opportunities

Both guides emphasize that the candidate demonstrates **strong potential for senior IC track** with mentorship on theoretical foundations. The submission quality (especially documentation and business framing) is exceptional—gaps are in depth, not breadth.