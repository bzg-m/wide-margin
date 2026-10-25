export type FieldError = { field: string; message: string };

/** An RFC 9457 Problem Details body, as returned by every API error. */
export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: FieldError[];
};
