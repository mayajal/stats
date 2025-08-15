import Image from 'next/image';

export default function DataArrangementPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Data Arrangement for Analysis</h1>

      <p className="mb-8">
        Proper data arrangement is crucial for running statistical analyses like Randomized Block Design (RBD) and Factorial Randomized Block Design (FRBD). This guide illustrates how to transform your raw data into a format suitable for our analysis tools.
      </p>

      <div className="space-y-12">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Randomized Complete Block Design (RCBD)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-medium mb-2">Raw Data Format</h3>
              <p className="mb-4">
                Typically, raw data from field trials is arranged with treatments as columns and blocks as rows. That format is not suitable for our analysis tool. 
              </p>  
              <p className="mb-4">
                Below is an example dataset. The data was gathered from a field experiment where six different seed rates were tested in randomized block design, each with four replications. Here seed rate is the &quot;factor&quot; and replication is the &quot;block&quot;. The &quot;values&quot; are grain yields measured in kg/ha. (source: Gomez &amp; Gomez, 1984, p. 26)
              </p>
              
              <Image
                src="/assets/rbd_raw_data.png"
                alt="Raw data format for RBD analysis"
                width={500}
                height={300}
                className="rounded-lg border"
              />
              
              <p className="mb-4">
                To use this data in our tool, you need to convert it into a &quot;melted&quot; format, as shown in the image in right. You can either do it manually or use a tool like <a href="https://insio.chloropy.com/" className="text-blue-600 hover:underline">INSIO</a>
                
              </p>
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2">Melted Data Format</h3>
              <p className="mb-4">
                For our tool, you need to &quot;melt&quot; the data into a long format with three columns: Treatment (factor), Replication (block), and Yield (value).
              </p>
              <Image
                src="/assets/rbd_melted_data.png"
                alt="Melted data format for RBD analysis"
                width={500}
                height={300}
                className="rounded-lg border"
              />
            </div>
          </div>
        </div>

        <hr className="my-12" />
        <div id="frbd-section">
          <h2 className="text-2xl font-semibold mb-4">Factorial RBD (FRBD)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-medium mb-2">Raw Data Format</h3>
              <p className="mb-4">
                FRBD data is often more complex, with multiple factors in columns.
              </p>

               <p className="mb-4">
                Below is an example dataset. The data was gathered from a field experiment where three different varieties were tested with five levels of nitrogen in a factorial randomized block design, each replicated four times. Here nitrogen level is  &quot;factor 1&quot;, variety is &quot;factor 2&quot; and replication is the &quot;block&quot;. The &quot;values&quot; are grain yields measured in t/ha. (source: Gomez &amp; Gomez, 1984, p. 92)
              </p>
              
              <div className="border rounded-lg p-4 bg-gray-100 dark:bg-gray-800">
                <Image
                src="/assets/frbd_raw_data.png"
                alt="Melted data format for FRBD analysis"
                width={500}
                height={300}
                className="rounded-lg border"
              />
              </div>

              <p className="mb-4">
                To use this data in our tool, you need to convert it into a &quot;melted&quot; format, as shown in the image in right. You can either do it manually or use a tool like <a href="https://insio.chloropy.com/" className="text-blue-600 hover:underline">INSIO</a>
              </p>
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2">Melted Data Format</h3>
              <p className="mb-4">
                The melted format for FRBD requires columns for each factor, plus columns for Block and Value.
              </p>
              <Image
                src="/assets/frbd_melted_data.png"
                alt="Melted data format for FRBD analysis"
                width={500}
                height={300}
                className="rounded-lg border"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}