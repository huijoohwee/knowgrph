---
layout:
  mode: force
  forces:
    charge: -500
    linkDistance: 100
    centerStrength: 0.8
renderer:
  palette:
    nodes:
      idea: "#007BFF"
      hypothesis: "#FFC107"
      execution: "#28A745"
      pivot: "#FD7E14"
      alert: "#DC3545"
---

# AI Engineering Book Summaries

This document contains summaries of chapters from the *AI Engineering* book by Chip Huyen.

## Chapter 1: Introduction to Building AI Applications with Foundation Models

This chapter explains the emergence of AI engineering as a discipline.

### Common generative AI use cases

| Category | Examples of Consumer Use Cases | Examples of Enterprise Use Cases |
|---|---|---|
| Coding | Coding | Coding |
| Image and Video Production | Photo and video editing, Design | Presentation, Ad generation |
| Writing | Email, Social media and blog posts | Copywriting, SEO, Reports, memos, design docs |
| Education | Tutoring | Essay grading, Employee onboarding, Employee upskill training |
| Conversational Bots | General chatbot, AI companion | Customer support, Product copilots |
| Information Aggregation | Summarization | Talk-to-your-docs, Summarization, Market research |
| Data Organization | Image search, Memex | Knowledge management, Document processing |
| Workflow Automation | Travel planning, Event planning | Data extraction, entry, and annotation, Lead generation |

The chapter discussed the rapid evolution of AI in recent years, starting with the transition from language models to large language models.

## Chapter 2: Understanding Foundation Models

This chapter discussed the core design decisions when building a foundation model.

### Training Data

A crucial factor affecting a model's performance is its training data. Large models require a large amount of training data.

## Chapter 3: Evaluation Methodology

Evaluation is critical for AI systems. It involves defining metrics and creating datasets to measure performance.

## Chapter 4: Evaluate AI Systems

Specific techniques for evaluating AI systems include human evaluation, model-based evaluation, and code-based metrics.

## Chapter 5: Prompt Engineering

Techniques for effective prompting such as few-shot prompting, chain-of-thought, and ReAct.

## Chapter 6: RAG and Agents

Retrieval Augmented Generation (RAG) and Agentic workflows allow models to access external data and perform actions.

## Chapter 7: Finetuning

When and how to finetune models. Covers techniques like PEFT and LoRA.

## Chapter 8: Dataset Engineering

Creating and managing datasets for AI. Data quality is often more important than model architecture.

## Chapter 9: Inference Optimization

Optimizing model inference for production. Techniques include quantization, pruning, and caching.

## Chapter 10: AI Engineering Architecture and User Feedback

Architecting AI systems and incorporating user feedback loops to improve the system over time.
