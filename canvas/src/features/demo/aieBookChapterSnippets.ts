export const AIE_BOOK_CHAPTER_SNIPPETS = {
  ch6: {
    title: 'Chapter 6: RAG and Agents',
    text: 'RAG employs a two-step process. It first retrieves relevant information from external memory and then uses this information to generate more accurate responses. The success of a RAG system depends on the quality of its retriever. Term-based retrievers, such as Elasticsearch and BM25, are much lighter to implement and can provide strong baselines. Embedding-based retrievers are more computationally intensive but have the potential to outperform term-based algorithms. The RAG pattern can be seen as a special case of agent where the retriever is a tool the model can use.',
  },
  ch7: {
    title: 'Chapter 7: Finetuning',
    text: "PEFT reduces finetuning's memory requirements by reducing the number of trainable parameters. LoRA has many properties that make it popular among practitioners. On top of being parameter-efficient and data-efficient, it's also modular, making it much easier to serve and combine multiple LoRA models. Model merging's goal is to combine multiple models into one model that works better than these models separately.",
  },
  ch5: {
    title: 'Chapter 5: Prompt Engineering',
    text: 'Foundation models can do many things, but you must tell them exactly what you want. The process of crafting an instruction to get a model to do what you want is called prompt engineering. Simple tricks like asking the model to slow down and think step by step can yield surprising improvements. Prompt engineering is easy to get started, which misleads many into thinking that it is easy to do it well.',
  },
} as const

export type AieBookChapterId = keyof typeof AIE_BOOK_CHAPTER_SNIPPETS
